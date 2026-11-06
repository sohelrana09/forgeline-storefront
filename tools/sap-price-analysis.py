#!/usr/bin/env python3
"""Measure how much of a daily SAP price export is shared between companies.

Answers the sizing questions in docs/erp-pricing.md ("Production: the nightly import") before
choosing between native commercetools prices (one price list per group of companies with identical
prices) and an external price service:

  - rows today: one price per company per SKU (what the export holds)
  - rows after fallback: company prices that equal the public price are left out
  - price lists: companies with identical prices across all SKUs share one list (one channel)
  - rows after grouping: one Standalone Price per price list and SKU
  - hybrid: shared price lists go native; a company without one joins the closest shared list and
    only the SKUs where it differs go to an exception service (API Extension)
  - discount groups (needs --base-company): SKUs whose company price / public price factors are the same
    for every company; prices then follow public price x factor(company, group) plus special prices
  - daily change: new, changed and removed prices against yesterday's export (--previous)

Input is CSV or JSON Lines (optionally .gz), one row per company, SKU and quantity break.
Only the Python standard library is used; any size works: rows are split into partition files by
company first, then each partition is analysed in memory. --sample analyses a share of the
companies for a quick estimate.

Examples:
  python3 tools/sap-price-analysis.py prices.csv.gz --base-company PUBLIC
  python3 tools/sap-price-analysis.py today.csv --previous yesterday.csv --sample 5 --json report.json
  python3 tools/sap-price-analysis.py prices.txt --delimiter ';' --decimal-comma \\
      --company-col KUNNR --sku-col MATNR --price-col KBETR --qty-col KSTBM --currency-col KONWA
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import os
import shutil
import statistics
import sys
import tempfile
import time
import zlib
from collections import Counter
from decimal import Decimal, InvalidOperation

STANDALONE_PRICES_PER_VARIANT = 50_000  # commercetools limit (soft), docs.commercetools.com/api/limits
SEP = "\x1f"  # joins SKU and scope values into one item key
MASK = (1 << 64) - 1


def h64(text: str) -> int:
    return int.from_bytes(hashlib.blake2b(text.encode(), digest_size=8).digest(), "big")


def open_text(path: str):
    if path.endswith(".gz"):
        return io.TextIOWrapper(gzip.open(path, "rb"), encoding="utf-8-sig", newline="")
    return open(path, encoding="utf-8-sig", newline="")


def number(value, decimal_comma: bool) -> str:
    text = str(value).strip()
    if decimal_comma:
        text = text.replace(".", "").replace(",", ".")
    else:
        text = text.replace(",", "")
    return format(Decimal(text).normalize(), "f")


class Reader:
    def __init__(self, args):
        self.args = args
        self.scope_cols = [c for c in ([args.currency_col] if args.currency_col else []) + args.scope_cols if c]

    def rows(self, path: str):
        """Yields (company, item, qty, price); counts skipped rows."""
        self.skipped = 0
        if self.args.format == "pricing-api-response":
            yield from self.pricing_api_response(path)
            return
        with open_text(path) as f:
            jsonl = self.args.format == "jsonl" or (self.args.format == "auto" and (".jsonl" in path or ".ndjson" in path))
            if jsonl:
                records = (json.loads(line) for line in f if line.strip())
            else:
                records = csv.DictReader(f, delimiter=self.args.delimiter)
            for rec in records:
                try:
                    company = str(rec[self.args.company_col]).strip()
                    sku = str(rec[self.args.sku_col]).strip()
                    price = number(rec[self.args.price_col], self.args.decimal_comma)
                    raw_qty = rec.get(self.args.qty_col) if self.args.qty_col else None
                    qty = number(raw_qty, self.args.decimal_comma) if raw_qty not in (None, "") else "1"
                    scope = [str(rec.get(c, "")).strip() for c in self.scope_cols]
                except (KeyError, InvalidOperation, ValueError, TypeError):
                    self.skipped += 1
                    continue
                if not company or not sku:
                    self.skipped += 1
                    continue
                yield company, SEP.join([sku, *scope]), qty, price

    def pricing_api_response(self, path: str):
        """Adobe Commerce table pricing_api_response, dumped as `company_id <TAB> prices` lines:
        prices = {"<sku>": {"": "{\\"p\\":\\"12.91\\",\\"ud\\":...}", "15": ...}}, "" = quantity 1."""
        with open_text(path) as f:
            for line in f:
                company, _, prices = line.rstrip("\r\n").partition("\t")
                company = company.strip()
                try:
                    skus = json.loads(prices) if prices and prices != "NULL" else {}
                except ValueError:
                    self.skipped += 1
                    continue
                for sku, ladder in skus.items():
                    for qty, value in (ladder or {}).items():
                        try:
                            entry = json.loads(value) if isinstance(value, str) else value
                            price = number(entry["p"], self.args.decimal_comma)
                            qty = number(qty, self.args.decimal_comma) if qty not in ("", None) else "1"
                        except (KeyError, TypeError, ValueError, InvalidOperation):
                            self.skipped += 1
                            continue
                        if company and sku:
                            yield company, sku, qty, price


def partition(reader: Reader, path: str, out_dir: str, parts: int, sample: float, base: str | None) -> dict:
    """Splits rows into partition files by company. Returns counts."""
    files = [open(os.path.join(out_dir, f"{i}.tsv"), "w", encoding="utf-8") for i in range(parts)]
    read = kept = 0
    started = time.time()
    try:
        for company, item, qty, price in reader.rows(path):
            read += 1
            if read % 1_000_000 == 0:
                print(f"  {path}: {read:,} rows, {time.time() - started:.0f} s", file=sys.stderr)
            bucket = zlib.crc32(company.encode())
            if sample < 100 and company != base and (bucket % 10_000) >= sample * 100:
                continue
            kept += 1
            clean = [v.replace("\t", " ").replace("\n", " ") for v in (company, item, qty, price)]
            files[bucket % parts].write("\t".join(clean) + "\n")
    finally:
        for f in files:
            f.close()
    return {"read": read, "kept": kept, "skipped": reader.skipped}


def load(path: str) -> tuple[dict, int]:
    """company -> item -> {qty: price}; returns duplicates (same company, item and qty) too."""
    data: dict = {}
    duplicates = 0
    if not os.path.exists(path):
        return data, 0
    with open(path, encoding="utf-8") as f:
        for line in f:
            company, item, qty, price = line.rstrip("\n").split("\t")
            ladder = data.setdefault(company, {}).setdefault(item, {})
            if qty in ladder:
                duplicates += 1
            ladder[qty] = price
    return data, duplicates


def ladder_key(ladder: dict) -> tuple[int, int]:
    """Hash of a price ladder (sorted by quantity) and its number of tiers."""
    steps = sorted(ladder.items(), key=lambda kv: Decimal(kv[0]))
    return h64(";".join(f"{q}={p}" for q, p in steps)), len(steps)


def own_prices(items: dict, base: dict) -> dict:
    """item -> ladder hash, leaving out ladders equal to the public price."""
    own = {}
    for item, ladder in items.items():
        key = ladder_key(ladder)[0]
        if base.get(item) != key:
            own[item] = key
    return own


def factor(ladder: dict, public: Decimal | None, digits: int) -> str | None:
    """Company quantity-1 price ÷ public price, rounded: the company's discount on this SKU."""
    if public is None or "1" not in ladder:
        return None
    return str(round(Decimal(ladder["1"]) / public, digits))


def discount_groups(args, order: list, cur_dir: str, companies: int, base_price: dict, item_pattern: dict, item_factors: Counter) -> dict:
    """SKUs whose factors are identical for every company form a discount group (SAP: material
    pricing group). Prices then follow: public price × factor(company, group), plus special prices.

    A SKU outside the groups joins the group most companies agree with; the companies that don't
    agree are special prices (exceptions)."""
    by_pattern: dict = {}
    for item, pattern in item_pattern.items():
        by_pattern.setdefault(pattern, []).append(item)
    sizes = sorted((len(items) for items in by_pattern.values()), reverse=True)
    groups = {p: items[0] for p, items in by_pattern.items() if len(items) >= args.group_min_skus}  # pattern -> sample SKU
    loose = {item for item, p in item_pattern.items() if p not in groups}
    agree: dict = {}  # loose item -> Counter(group pattern -> companies with the group's factor)
    if groups and loose:
        for n, i in enumerate(order, 1):
            print(f"Matching SKUs to discount groups {n}/{args.partitions}...", file=sys.stderr)
            data, _ = load(os.path.join(cur_dir, f"{i}.tsv"))
            for company, items in data.items():
                if company == args.base_company:
                    continue
                by_factor: dict = {}  # this company's factor -> groups that have it
                for p, sample in groups.items():
                    f = factor(items.get(sample, {}), base_price.get(sample), args.factor_digits)
                    if f is not None:
                        by_factor.setdefault(f, []).append(p)
                for item in loose.intersection(items):
                    f = factor(items[item], base_price.get(item), args.factor_digits)
                    for p in by_factor.get(f, ()):
                        agree.setdefault(item, Counter())[p] += 1
    exceptions = sum(item_factors[item] - max(agree.get(item, {0: 0}).values()) for item in loose)
    company_prices = sum(item_factors.values())
    return {
        "factor_digits": args.factor_digits,
        "group_min_skus": args.group_min_skus,
        "skus_with_public_price": len(item_pattern),
        "factor_patterns": len(by_pattern),
        "coverage_percent": {str(n): round(100 * sum(sizes[:n]) / max(len(item_pattern), 1), 1) for n in (10, 25, 50, 100, 500)},
        "groups": len(groups),
        "skus_in_groups": len(item_pattern) - len(loose),
        "company_prices": company_prices,
        "factors": companies * len(groups),
        "exceptions": exceptions,
        "exception_percent": round(100 * exceptions / company_prices, 2) if company_prices else 0,
        "rows_as_formula": len(base_price) + companies * len(groups) + exceptions,
    }


def percentile(values: list, p: float):
    if not values:
        return 0
    values = sorted(values)
    return values[min(len(values) - 1, int(round(p / 100 * (len(values) - 1))))]


def analyse(args) -> dict:
    reader = Reader(args)
    tmp = tempfile.mkdtemp(prefix="sap-prices-", dir=args.tmp)
    try:
        cur_dir, prev_dir = os.path.join(tmp, "current"), os.path.join(tmp, "previous")
        os.makedirs(cur_dir)
        print("Partitioning the export...", file=sys.stderr)
        input_counts = partition(reader, args.export, cur_dir, args.partitions, args.sample, args.base_company)
        previous_counts = None
        if args.previous:
            os.makedirs(prev_dir)
            print("Partitioning the previous export...", file=sys.stderr)
            previous_counts = partition(reader, args.previous, prev_dir, args.partitions, args.sample, args.base_company)

        order = list(range(args.partitions))
        if args.base_company:  # the public prices are needed before any company is compared with them
            first = zlib.crc32(args.base_company.encode()) % args.partitions
            order.remove(first)
            order.insert(0, first)

        base: dict = {}
        base_price: dict = {}  # item -> public quantity-1 price, for discount factors
        item_pattern: dict = {}  # item -> order-independent hash of (company, factor) over all companies
        item_factors: Counter = Counter()  # companies with a factor per item
        companies = pairs = equal_to_base = duplicates = 0
        on_base_only = 0  # companies whose prices all equal the public price
        tiers = Counter()
        item_companies: Counter = Counter()
        item_ladders: dict = {}
        groups: dict = {}  # signature -> [companies, rows]
        company_group: dict = {}  # company -> signature
        item_rows: Counter = Counter()  # Standalone Prices per item after grouping
        change = Counter()

        for n, i in enumerate(order, 1):
            print(f"Analysing partition {n}/{args.partitions}...", file=sys.stderr)
            data, dup = load(os.path.join(cur_dir, f"{i}.tsv"))
            duplicates += dup
            hashed: dict = {}
            if args.base_company and args.base_company in data and not base:
                base = {item: ladder_key(l)[0] for item, l in data[args.base_company].items()}
                base_price = {item: Decimal(l["1"]) for item, l in data[args.base_company].items() if Decimal(l.get("1", "0"))}
            for company, items in data.items():
                own = {}
                for item, ladder in items.items():
                    key, steps = ladder_key(ladder)
                    hashed.setdefault(company, {})[item] = key
                    if company == args.base_company:
                        continue
                    f = factor(ladder, base_price.get(item), args.factor_digits)
                    if f is not None:
                        item_pattern[item] = (item_pattern.get(item, 0) + h64(f"{company}={f}")) & MASK
                        item_factors[item] += 1
                    tiers[steps] += 1
                    pairs += 1
                    item_companies[item] += 1
                    item_ladders.setdefault(item, set()).add(key)
                    if base.get(item) == key:
                        equal_to_base += 1
                    else:
                        own[item] = key
                if company == args.base_company:
                    continue
                companies += 1
                if not own:
                    on_base_only += 1
                    continue
                signature = h64("|".join(f"{k}:{v}" for k, v in sorted(own.items())))
                company_group[company] = signature
                group = groups.get(signature)
                if group is None:
                    groups[signature] = [1, len(own)]
                    for item in own:
                        item_rows[item] += 1
                else:
                    group[0] += 1
            del data

            if args.previous:
                prev, _ = load(os.path.join(prev_dir, f"{i}.tsv"))
                for company in set(hashed) | set(prev):
                    now, before = hashed.get(company, {}), prev.get(company, {})
                    for item, key in now.items():
                        if item not in before:
                            change["new"] += 1
                        elif ladder_key(before[item])[0] != key:
                            change["changed"] += 1
                        else:
                            change["unchanged"] += 1
                    change["removed"] += sum(1 for item in before if item not in now)

        # Hybrid: a company without a shared list joins the closest of the largest shared lists and keeps
        # only the SKUs where it differs as exceptions (served by the external price service).
        nearest = [s for s, g in sorted(groups.items(), key=lambda kv: -kv[1][0]) if g[0] >= args.min_group][: args.nearest]
        lonely = {c for c, s in company_group.items() if groups[s][0] < args.min_group}
        joined = exception_rows = 0
        if nearest and lonely:
            wanted = set(nearest)
            lists: dict = {}  # signature -> {item: ladder hash} of one member
            for n, i in enumerate(order, 1):
                print(f"Reading price lists {n}/{args.partitions}...", file=sys.stderr)
                data, _ = load(os.path.join(cur_dir, f"{i}.tsv"))
                for company, items in data.items():
                    s = company_group.get(company)
                    if s in wanted and s not in lists:
                        lists[s] = own_prices(items, base)
                if len(lists) == len(wanted):
                    break
            index: dict = {}  # (item, ladder hash) -> lists with that price
            item_index: dict = {}  # item -> lists with any price for it
            for s, prices in lists.items():
                for item_key in prices.items():
                    index.setdefault(item_key, []).append(s)
                    item_index.setdefault(item_key[0], []).append(s)
            for n, i in enumerate(order, 1):
                print(f"Matching companies to price lists {n}/{args.partitions}...", file=sys.stderr)
                data, _ = load(os.path.join(cur_dir, f"{i}.tsv"))
                for company in lonely.intersection(data):
                    own = own_prices(data[company], base)
                    matches: Counter = Counter()
                    shared_items: Counter = Counter()
                    for item_key in own.items():
                        for s in index.get(item_key, ()):
                            matches[s] += 1
                        for s in item_index.get(item_key[0], ()):
                            shared_items[s] += 1
                    # exceptions = own prices that differ from the list + SKUs where the list has a price
                    # but the company pays the public one
                    best = min((len(own) - matches[s] + len(lists[s]) - n for s, n in shared_items.items()), default=len(own))
                    if best < len(own):
                        joined += 1
                    exception_rows += min(best, len(own))

        formula = None
        if base_price and item_pattern:
            formula = discount_groups(args, order, cur_dir, companies, base_price, item_pattern, item_factors)

        rows_grouped = sum(item_rows.values())
        sizes = sorted(groups.values(), key=lambda g: -g[0])
        singletons = [g for g in sizes if g[0] < args.min_group]
        shared = [g for g in sizes if g[0] >= args.min_group]
        per_item_companies = list(item_companies.values())
        per_item_ladders = [len(s) for s in item_ladders.values()]
        scale = 100 / args.sample

        report = {
            "input": {"export": args.export, **input_counts, "duplicates": duplicates, "sample_percent": args.sample},
            "companies": companies,
            "items": len(item_companies),
            "rows_today": pairs,
            "rows_equal_to_public_price": equal_to_base,
            "rows_after_fallback": pairs - equal_to_base,
            "companies_on_public_price_only": on_base_only,
            "price_lists": len(groups),
            "rows_after_grouping": rows_grouped,
            "reduction_factor": round(pairs / rows_grouped, 1) if rows_grouped else None,
            "largest_price_lists": [{"companies": c, "rows": r} for c, r in sizes[:10]],
            "hybrid": {
                "min_group": args.min_group,
                "native_price_lists": len(shared),
                "native_companies": sum(c for c, _ in shared),
                "native_rows": sum(r for _, r in shared),
                "exception_companies": sum(c for c, _ in singletons),
                "joining_nearest_list": joined,
                "exception_rows": exception_rows if nearest else sum(r for _, r in singletons),
            },
            "per_item": {
                "companies_median": statistics.median(per_item_companies) if per_item_companies else 0,
                "companies_max": max(per_item_companies, default=0),
                "distinct_ladders_median": statistics.median(per_item_ladders) if per_item_ladders else 0,
                "distinct_ladders_p95": percentile(per_item_ladders, 95),
                "distinct_ladders_max": max(per_item_ladders, default=0),
                "prices_after_grouping_max": max(item_rows.values(), default=0),
                "items_over_variant_limit": sum(1 for v in item_rows.values() if v * scale > STANDALONE_PRICES_PER_VARIANT),
            },
            "discount_groups": formula,
            "tiers": {"ladders": sum(tiers.values()), "multi_tier": sum(v for k, v in tiers.items() if k > 1), "max": max(tiers, default=0)},
        }
        if args.base_company and not base:
            report["warning"] = f"--base-company {args.base_company} has no rows in the export"
        if args.previous:
            total = change["new"] + change["changed"] + change["unchanged"]
            report["daily_change"] = {
                "previous": args.previous,
                **{k: change[k] for k in ("new", "changed", "removed", "unchanged")},
                "changed_percent": round(100 * (change["new"] + change["changed"] + change["removed"]) / total, 2) if total else 0,
                "previous_input": previous_counts,
            }
        if args.sample < 100:
            report["estimate_full"] = {
                "companies": round(companies * scale),
                "rows_today": round(pairs * scale),
                "rows_after_grouping_at_most": round(rows_grouped * scale),
            }
        return report
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def verdict(r: dict) -> str:
    if not r["rows_today"]:
        return "No company prices found: check the column names."
    factor = r["rows_today"] / max(r["rows_after_grouping"], 1)
    h = r["hybrid"]
    exception_share = h["exception_rows"] / max(h["native_rows"] + h["exception_rows"], 1)
    hybrid_factor = r["rows_today"] / max(h["native_rows"] + h["exception_rows"], 1)
    if r["per_item"]["items_over_variant_limit"]:
        return "Some SKUs would exceed 50,000 prices per variant: hybrid (shared price lists native, the rest in an external price service) or a limit review with commercetools."
    if factor >= 20 and exception_share < 0.1:
        return f"Native price lists fit: grouping shrinks the prices {factor:.0f}x. Import the price lists into commercetools."
    d = r.get("discount_groups")
    if d and d["exception_percent"] <= 10 and d["rows_as_formula"] * 2 < h["native_rows"] + h["exception_rows"]:
        return (
            f"Formula: prices are the public price x a company discount per group ({d['groups']} groups) plus {d['exception_percent']}% special "
            f"prices; {r['rows_today'] / max(d['rows_as_formula'], 1):.0f}x fewer rows. Only if SAP can supply its conditions "
            "(factors derived from calculated prices round differently): store them in a price engine (API Extension for carts); "
            "otherwise keep SAP's calculated prices in the price service. Public and B2C prices stay native in commercetools."
        )
    if hybrid_factor >= 5:
        return (
            f"Hybrid: shared price lists plus exceptions shrink the prices {hybrid_factor:.0f}x; {exception_share:.0%} of those rows are "
            "company exceptions. Import the shared price lists, serve the exceptions through an API Extension."
        )
    return f"Mostly unique per company (grouping shrinks the prices only {factor:.1f}x): keep the external price service with an API Extension, import only public and B2C prices."


def print_report(r: dict) -> None:
    f = lambda n: f"{n:,}"
    print()
    print(f"Input           {f(r['input']['read'])} rows read, {f(r['input']['kept'])} analysed, {f(r['input']['skipped'])} skipped, {f(r['input']['duplicates'])} duplicates")
    if r["input"]["sample_percent"] < 100:
        print(f"Sample          {r['input']['sample_percent']}% of companies (estimates below are scaled)")
    print(f"Companies       {f(r['companies'])} ({f(r['companies_on_public_price_only'])} pay only the public price)")
    print(f"SKUs            {f(r['items'])} (per SKU and scope)")
    print()
    print(f"Rows today            {f(r['rows_today'])}   one price per company and SKU")
    print(f"Rows after fallback   {f(r['rows_after_fallback'])}   ({f(r['rows_equal_to_public_price'])} equal the public price)")
    print(f"Price lists           {f(r['price_lists'])}   companies with identical prices share one")
    print(f"Rows after grouping   {f(r['rows_after_grouping'])}   ({r['reduction_factor']}x smaller)")
    print()
    print("Largest price lists   " + ", ".join(f"{g['companies']} companies / {f(g['rows'])} rows" for g in r["largest_price_lists"][:5]))
    h = r["hybrid"]
    print(f"Hybrid (groups of {h['min_group']}+) native: {f(h['native_price_lists'])} lists, {f(h['native_companies'])} companies, {f(h['native_rows'])} rows")
    print(f"                      others: {f(h['exception_companies'])} companies, {f(h['joining_nearest_list'])} join the closest list")
    print(f"                      exceptions: {f(h['exception_rows'])} rows where a company differs from its list")
    print()
    p = r["per_item"]
    print(f"Per SKU               companies median {p['companies_median']}, max {f(p['companies_max'])}")
    print(f"                      distinct ladders median {p['distinct_ladders_median']}, p95 {p['distinct_ladders_p95']}, max {f(p['distinct_ladders_max'])}")
    print(f"                      prices after grouping max {f(p['prices_after_grouping_max'])} (limit {f(STANDALONE_PRICES_PER_VARIANT)} per variant; {p['items_over_variant_limit']} SKUs over)")
    d = r.get("discount_groups")
    if d:
        c = d["coverage_percent"]
        print(f"Discount groups       {f(d['factor_patterns'])} factor patterns over {f(d['skus_with_public_price'])} SKUs; top 10/25/50/100 cover {c['10']}/{c['25']}/{c['50']}/{c['100']}%")
        print(f"                      {f(d['groups'])} groups ({d['group_min_skus']}+ SKUs) hold {f(d['skus_in_groups'])} SKUs; {f(d['exceptions'])} special prices ({d['exception_percent']}% of {f(d['company_prices'])})")
        print(f"                      as a formula: {f(d['rows_as_formula'])} rows (public prices + {f(d['factors'])} company factors + special prices)")
    t = r["tiers"]
    print(f"Tiers                 {f(t['multi_tier'])} of {f(t['ladders'])} ladders have breaks, up to {t['max']} steps")
    if "daily_change" in r:
        d = r["daily_change"]
        print(f"Daily change          {f(d['new'])} new, {f(d['changed'])} changed, {f(d['removed'])} removed, {f(d['unchanged'])} unchanged ({d['changed_percent']}%)")
    if "estimate_full" in r:
        e = r["estimate_full"]
        print(f"Full export (est.)    {f(e['companies'])} companies, {f(e['rows_today'])} rows today, at most {f(e['rows_after_grouping_at_most'])} after grouping")
    if "warning" in r:
        print(f"Warning               {r['warning']}")
    print()
    print("Verdict: " + verdict(r))


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("export", help="today's price export (.csv, .tsv, .jsonl, optionally .gz)")
    p.add_argument("--previous", help="yesterday's export in the same format, for the daily change rate")
    p.add_argument("--format", choices=["auto", "csv", "jsonl", "pricing-api-response"], default="auto")
    p.add_argument("--delimiter", default=",", help="CSV delimiter (default ,; use '\\t' for tabs)")
    p.add_argument("--decimal-comma", action="store_true", help="numbers like 1.234,50")
    p.add_argument("--company-col", default="company", help="company / business partner column (SAP KUNNR)")
    p.add_argument("--sku-col", default="sku", help="SKU column (SAP MATNR)")
    p.add_argument("--price-col", default="price", help="unit price column (SAP KBETR)")
    p.add_argument("--qty-col", default="min_qty", help="tier minimum quantity column (SAP KSTBM); missing = 1")
    p.add_argument("--currency-col", default="currency", help="currency column; empty string to ignore")
    p.add_argument("--scope-cols", default="", help="more columns that make a price distinct, comma-separated (e.g. country,valid_from)")
    p.add_argument("--base-company", help="company value of the public / list price rows; company prices equal to it are left out")
    p.add_argument("--min-group", type=int, default=2, help="companies a price list needs to go native in the hybrid figures (default 2)")
    p.add_argument("--nearest", type=int, default=20, help="largest shared lists a company without one may join (default 20; 0 = off)")
    p.add_argument("--factor-digits", type=int, default=3, help="decimals of company price / public price when finding discount groups (default 3)")
    p.add_argument("--group-min-skus", type=int, default=20, help="SKUs a factor pattern needs to count as a discount group (default 20)")
    p.add_argument("--sample", type=float, default=100, help="percent of companies to analyse (default 100)")
    p.add_argument("--partitions", type=int, default=64, help="partition files (raise for very large exports; default 64)")
    p.add_argument("--tmp", help="directory for partition files (needs about the export's size)")
    p.add_argument("--json", help="also write the report as JSON to this file")
    args = p.parse_args()
    args.delimiter = "\t" if args.delimiter in ("\\t", "tab") else args.delimiter
    args.scope_cols = [c.strip() for c in args.scope_cols.split(",") if c.strip()]
    if not 0 < args.sample <= 100:
        p.error("--sample must be between 0 and 100")

    report = analyse(args)
    print_report(report)
    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print(f"Report written to {args.json}")


if __name__ == "__main__":
    main()
