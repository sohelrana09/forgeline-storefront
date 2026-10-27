import type { ProductProjection, ProductVariant } from "@commercetools/platform-sdk";
import { allVariants, localize } from "@/features/catalog/utils";
import { formatMoney } from "@/lib/utils";

// Magento-style layered navigation for category pages, computed from the category's products (price-selected for the
// visitor): Product Projection Search and its facets are deactivated in this project, and a category holds at most a
// few hundred products. Pure: no API calls, so it is unit-tested (layered.test.ts).
//
// URL state (shareable, works without JavaScript): ?price=100-200 (whole currency units, both ends included; "300-"
// = and above; the slider's plain form sends ?price_from&price_to instead),
// ?cat=<child slug>, ?mobility=tracked, ?model=2019, ?color=red, ?iso45001=yes, ?capacity=1000-9999, plus
// ?sort=<field>-<dir>, ?limit and ?page. One value per filter, as in Magento: an applied filter leaves the sidebar
// and shows under "Now Shopping by".

export const SORTS = {
  "name-asc": { field: "name", dir: "asc", label: "Product Name" },
  "name-desc": { field: "name", dir: "desc", label: "Product Name" },
  "price-asc": { field: "price", dir: "asc", label: "Price" },
  "price-desc": { field: "price", dir: "desc", label: "Price" },
  newest: { field: "newest", dir: "desc", label: "Newest" },
} as const;
export type SortKey = keyof typeof SORTS;
export const DEFAULT_SORT: SortKey = "name-asc";
export const LIMITS = [12, 24, 48] as const;
export const DEFAULT_LIMIT = 24;

type AttributeFilter = {
  key: "mobility" | "model" | "color" | "iso45001" | "capacity";
  label: string;
  // The option a variant has for this filter (undefined: none), with its label.
  option: (variant: ProductVariant) => { value: string; label: string } | undefined;
  order?: (a: string, b: string) => number;
};

const attr = (v: ProductVariant, name: string) => v.attributes?.find((a) => a.name === name)?.value as unknown;

const CAPACITY_BUCKETS = [
  { value: "0-499", label: "Under 500", from: 0, to: 500 },
  { value: "500-999", label: "500 to 999", from: 500, to: 1000 },
  { value: "1000-9999", label: "1,000 to 9,999", from: 1000, to: 10_000 },
  { value: "10000-", label: "10,000 and above", from: 10_000, to: Infinity },
];

export const ATTRIBUTE_FILTERS: AttributeFilter[] = [
  {
    key: "mobility",
    label: "Mobility",
    option: (v) => {
      const e = attr(v, "mobility") as { key?: string; label?: string } | undefined;
      return e?.key ? { value: e.key.toLowerCase(), label: e.label || e.key } : undefined;
    },
  },
  {
    key: "model",
    label: "Model year",
    option: (v) => {
      const n = attr(v, "model");
      return typeof n === "number" ? { value: String(n), label: String(n) } : undefined;
    },
    order: (a, b) => Number(b) - Number(a),
  },
  {
    key: "color",
    label: "Color",
    option: (v) => {
      const e = attr(v, "color") as { key?: string; label?: Record<string, string> | string } | undefined;
      if (!e?.key) return undefined;
      const label = typeof e.label === "string" ? e.label : e.label ? localize(e.label) : e.key;
      return { value: e.key.toLowerCase(), label: label.charAt(0) + label.slice(1).toLowerCase() };
    },
  },
  {
    key: "iso45001",
    label: "ISO 45001 certified",
    option: (v) => {
      const b = attr(v, "iso45001");
      return typeof b === "boolean" ? { value: b ? "yes" : "no", label: b ? "Yes" : "No" } : undefined;
    },
    order: (a, b) => (a === "yes" ? -1 : b === "yes" ? 1 : 0),
  },
  {
    key: "capacity",
    label: "Capacity",
    option: (v) => {
      const n = attr(v, "capacity");
      if (typeof n !== "number") return undefined;
      const bucket = CAPACITY_BUCKETS.find((b) => n >= b.from && n < b.to);
      return bucket && { value: bucket.value, label: bucket.label };
    },
    order: (a, b) => parseInt(a, 10) - parseInt(b, 10),
  },
];

export type Filters = Partial<Record<AttributeFilter["key"] | "price" | "cat", string>>;
export const FILTER_KEYS = ["price", "cat", ...ATTRIBUTE_FILTERS.map((f) => f.key)] as const;
const VALUE = /^[a-z0-9-]{1,40}$/;

// Only known keys with plain values; a repeated parameter keeps its first value.
export function parseFilters(query: Record<string, string | string[] | undefined>): Filters {
  const filters: Filters = {};
  for (const key of FILTER_KEYS) {
    const raw = query[key];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.toLowerCase();
    if (value && VALUE.test(value)) filters[key] = value;
  }
  // The price slider's plain form (no JavaScript) sends From and To.
  const whole = (raw: string | string[] | undefined) => {
    const n = Math.round(Number(Array.isArray(raw) ? raw[0] : raw));
    return Number.isFinite(n) && n >= 0 && n < 1e9 ? n : undefined;
  };
  const from = whole(query.price_from);
  const to = whole(query.price_to);
  if (from !== undefined || to !== undefined) filters.price = `${from ?? 0}-${to ?? ""}`;
  return filters;
}

export function parseSort(raw?: string | string[]): SortKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value in SORTS ? (value as SortKey) : DEFAULT_SORT;
}

export function parseLimit(raw?: string | string[]): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return (LIMITS as readonly number[]).includes(n) ? n : DEFAULT_LIMIT;
}

// The price a product is filtered and sorted by: its master variant's (discounted) price, as the product card shows.
function priceOf(p: ProductProjection) {
  const price = p.masterVariant.price;
  return price && (price.discounted?.value ?? price.value);
}
const major = (m: { centAmount: number; fractionDigits: number }) => m.centAmount / 10 ** m.fractionDigits;

function inPriceRange(p: ProductProjection, range: string) {
  const [from, to] = range.split("-");
  const money = priceOf(p);
  if (!money) return false;
  const value = major(money);
  return value >= Number(from) && (to === "" || value <= Number(to));
}

// Categories: the child slug's whole subtree (products sit on leaf categories).
export type CategoryOption = { slug: string; name: string; ids: Set<string> };

function matches(p: ProductProjection, filters: Filters, categories: CategoryOption[], except?: string) {
  if (filters.price && except !== "price" && !inPriceRange(p, filters.price)) return false;
  if (filters.cat && except !== "cat") {
    const cat = categories.find((c) => c.slug === filters.cat);
    if (!cat || !p.categories.some((c) => cat.ids.has(c.id))) return false;
  }
  // One variant must satisfy every applied attribute filter (e.g. the 2019 model in red).
  const applied = ATTRIBUTE_FILTERS.filter((f) => filters[f.key] && f.key !== except);
  return applied.length === 0 || allVariants(p).some((v) => applied.every((f) => f.option(v)?.value === filters[f.key]));
}

export type FacetOption = { value: string; label: string; count: number };
export type Facet = { key: string; label: string; options: FacetOption[] };

// The price slider's range: the cheapest and dearest product among those matching every other filter (so moving
// the slider never shrinks its own track), in whole currency units, plus the current selection.
export type PriceRange = { min: number; max: number; from: number; to: number; currencyCode: string; fractionDigits: number };

function priceRange(products: ProductProjection[], selected: string | undefined): PriceRange | undefined {
  const prices = products.map(priceOf).filter((m): m is NonNullable<typeof m> => !!m);
  if (prices.length === 0) return undefined;
  const values = prices.map(major);
  const min = Math.floor(Math.min(...values));
  const max = Math.ceil(Math.max(...values));
  if (min === max && !selected) return undefined; // one price: nothing to slide
  const [from, to] = (selected ?? "").split("-");
  const clamp = (n: number, fallback: number) => (Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback);
  return {
    min,
    max,
    from: clamp(from === "" || from === undefined ? NaN : Number(from), min),
    to: clamp(to === "" || to === undefined ? NaN : Number(to), max),
    currencyCode: prices[0].currencyCode,
    fractionDigits: prices[0].fractionDigits,
  };
}

export type Layered = {
  products: ProductProjection[]; // filtered and sorted, all pages
  facets: Facet[]; // what can still narrow the list (applied filters are left out)
  price?: PriceRange; // the price slider (stays visible while a price is selected)
  applied: { key: string; label: string; value: string; valueLabel: string }[];
};

export function layer(products: ProductProjection[], filters: Filters, sort: SortKey, categories: CategoryOption[]): Layered {
  const filtered = products.filter((p) => matches(p, filters, categories));
  const facets: Facet[] = [];

  if (!filters.cat && categories.length > 0) {
    const options = categories
      .map((c) => ({ value: c.slug, label: c.name, count: filtered.filter((p) => p.categories.some((pc) => c.ids.has(pc.id))).length }))
      .filter((o) => o.count > 0);
    if (options.length > 0) facets.push({ key: "cat", label: "Category", options });
  }
  for (const f of ATTRIBUTE_FILTERS) {
    if (filters[f.key]) continue;
    const counts = new Map<string, FacetOption>();
    for (const p of filtered) {
      const seen = new Set<string>();
      for (const v of allVariants(p)) {
        const o = f.option(v);
        if (!o || seen.has(o.value)) continue;
        seen.add(o.value);
        const entry = counts.get(o.value) ?? { ...o, count: 0 };
        entry.count++;
        counts.set(o.value, entry);
      }
    }
    const options = [...counts.values()].sort((a, b) => (f.order ? f.order(a.value, b.value) : a.label.localeCompare(b.label)));
    // Only worth showing if some option narrows the list (every excavator comes in all three model years, say).
    if (options.some((o) => o.count < filtered.length)) {
      facets.push({ key: f.key, label: f.label, options });
    }
  }

  const applied: Layered["applied"] = [];
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (!value) continue;
    if (key === "cat") {
      applied.push({ key, label: "Category", value, valueLabel: categories.find((c) => c.slug === value)?.name ?? value });
    } else if (key === "price") {
      const [from, to] = value.split("-");
      const currency = products.map(priceOf).find(Boolean);
      const fmt = (n: string) =>
        currency ? formatMoney({ ...currency, centAmount: Math.round(Number(n) * 10 ** currency.fractionDigits) }) : n;
      applied.push({ key, label: "Price", value, valueLabel: to ? `${fmt(from)} - ${fmt(to)}` : `${fmt(from)} and above` });
    } else {
      const f = ATTRIBUTE_FILTERS.find((a) => a.key === key)!;
      const option = products
        .flatMap(allVariants)
        .map(f.option)
        .find((o) => o?.value === value);
      applied.push({ key, label: f.label, value, valueLabel: option?.label ?? value });
    }
  }

  const price = priceRange(
    products.filter((p) => matches(p, filters, categories, "price")),
    filters.price,
  );
  return { products: sortProducts(filtered, sort), facets, applied, price };
}

function sortProducts(products: ProductProjection[], sort: SortKey) {
  const { field, dir } = SORTS[sort];
  const sign = dir === "asc" ? 1 : -1;
  const name = (p: ProductProjection) => localize(p.name);
  return [...products].sort((a, b) => {
    if (field === "newest") return b.createdAt.localeCompare(a.createdAt);
    if (field === "price") {
      const pa = priceOf(a);
      const pb = priceOf(b);
      // Products without a price for this visitor go last, whatever the direction.
      if (!pa || !pb) return pa ? -1 : pb ? 1 : name(a).localeCompare(name(b));
      return sign * (major(pa) - major(pb)) || name(a).localeCompare(name(b));
    }
    return sign * name(a).localeCompare(name(b));
  });
}

// The category URL with the given state; defaults are left out so the plain URL stays the cached one.
export function catalogHref(
  basePath: string,
  state: { filters: Filters; sort: SortKey; limit: number; page?: number },
  change: Partial<{ filters: Filters; sort: SortKey; limit: number; page: number }> = {},
) {
  const filters = change.filters ?? state.filters;
  const sort = change.sort ?? state.sort;
  const limit = change.limit ?? state.limit;
  // Any change to what's listed starts again at page 1.
  const page = change.page ?? (change.filters || change.sort || change.limit ? 1 : (state.page ?? 1));
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) if (filters[key]) params.set(key, filters[key]!);
  if (sort !== DEFAULT_SORT) params.set("sort", sort);
  if (limit !== DEFAULT_LIMIT) params.set("limit", String(limit));
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `${basePath}${query ? `?${query}` : ""}`;
}
