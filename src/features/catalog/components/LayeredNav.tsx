"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";

// Magento-style "ajax" layered navigation: filter, sort and page-size changes fetch the new list in place (an RSC
// navigation without a full page load, the scroll position kept) while the current results dim. Every control is a
// real link or form, so it all still works without JavaScript, and every state is a shareable URL.

type Nav = { go: (href: string) => void; pending: boolean; filtersOpen: boolean; setFiltersOpen: (open: boolean) => void };
const NavContext = createContext<Nav | null>(null);
const useNav = () => useContext(NavContext);

export function CatalogNav({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const go = (href: string) => {
    setFiltersOpen(false);
    startTransition(() => router.push(href, { scroll: false }));
  };
  return <NavContext.Provider value={{ go, pending, filtersOpen, setFiltersOpen }}>{children}</NavContext.Provider>;
}

// A filter or "remove filter" link: in place with JavaScript, a normal link without (or with a modifier key).
export function NavLink({ href, className, children, label }: { href: string; className?: string; children: ReactNode; label?: string }) {
  const nav = useNav();
  return (
    <a
      href={href}
      aria-label={label}
      className={className}
      onClick={(e) => {
        if (!nav || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        nav.go(href);
      }}
    >
      {children}
    </a>
  );
}

// "Shop By": a sidebar on large screens, a toggle that opens the filters on phones (Magento mobile).
export function ShopByPanel({ applied, children }: { applied: number; children: ReactNode }) {
  const nav = useNav();
  const open = nav?.filtersOpen ?? false;
  return (
    <aside aria-label="Shop by" className="lg:w-64 lg:flex-none">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="shop-by-filters"
        onClick={() => nav?.setFiltersOpen(!open)}
        className="flex min-h-11 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-4 font-semibold lg:hidden"
      >
        <span>
          Shop By
          {applied > 0 && <span className="ml-2 rounded-full bg-orange-700 px-2 py-0.5 text-xs text-white">{applied}</span>}
        </span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <div
        id="shop-by-filters"
        className={`${open ? "block" : "hidden"} mt-3 lg:mt-0 lg:block ${nav?.pending ? "pointer-events-none opacity-60" : ""}`}
      >
        {children}
      </div>
    </aside>
  );
}

// The product list: dims with a spinner while the next one loads, and tells screen readers it's busy.
export function CatalogResults({ children }: { children: ReactNode }) {
  const pending = useNav()?.pending ?? false;
  return (
    <div aria-busy={pending} className="relative">
      <div className={pending ? "opacity-50 transition-opacity" : "transition-opacity"}>{children}</div>
      {pending && (
        <div role="status" className="absolute inset-x-0 top-24 flex justify-center">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-10 w-10 animate-spin text-orange-700" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="sr-only">Loading products</span>
        </div>
      )}
    </div>
  );
}

type Option = { value: string; label: string; href: string };

// Magento toolbar: "Sort By [field] ↑↓" and "Show [n] per page". Without JavaScript it's a GET form with Apply.
export function SortToolbar({
  fields,
  field,
  direction,
  limits,
  limit,
  hidden,
}: {
  fields: Option[];
  field: string;
  // The other direction's link, when the field has one.
  direction?: { dir: "asc" | "desc"; href: string };
  limits: Option[];
  limit: string;
  // The current filters, so the plain form keeps them.
  hidden: Record<string, string>;
}) {
  const nav = useNav();
  const pick = (options: Option[], value: string) => options.find((o) => o.value === value)?.href;
  return (
    <form className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="flex items-center gap-2">
        Sort By
        <select
          name="sort"
          defaultValue={field}
          onChange={(e) => {
            const href = pick(fields, e.target.value);
            if (href && nav) nav.go(href);
          }}
          className="min-h-11 rounded border border-gray-300 bg-white px-2"
        >
          {fields.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {direction && (
        <NavLink
          href={direction.href}
          label={direction.dir === "asc" ? "Set descending direction" : "Set ascending direction"}
          className="flex h-11 w-11 items-center justify-center rounded border border-gray-300 bg-white text-lg text-gray-800 no-underline hover:border-gray-500"
        >
          <span aria-hidden="true">{direction.dir === "asc" ? "↑" : "↓"}</span>
        </NavLink>
      )}
      <label className="flex items-center gap-2">
        Show
        <select
          name="limit"
          defaultValue={limit}
          onChange={(e) => {
            const href = pick(limits, e.target.value);
            if (href && nav) nav.go(href);
          }}
          className="min-h-11 rounded border border-gray-300 bg-white px-2"
        >
          {limits.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        per page
      </label>
      <noscript>
        <button className="min-h-11 rounded bg-gray-900 px-4 font-semibold text-white">Apply</button>
      </noscript>
    </form>
  );
}

// Price slider (Magento "price slider"): two handles on one track. It applies when you let go (or stop pressing
// arrow keys), and the whole range again means "no price filter". Without JavaScript: From / To fields and Apply.
export function PriceSlider({
  min,
  max,
  from,
  to,
  currencyCode,
  hrefFor,
  clearHref,
  hidden,
}: {
  min: number;
  max: number;
  from: number;
  to: number;
  currencyCode: string;
  // The category URL with "PRICE" where the selected range goes.
  hrefFor: string;
  clearHref: string;
  hidden: Record<string, string>;
}) {
  const nav = useNav();
  const [range, setRange] = useState({ from, to });
  const commit = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(commit.current), []);
  const step = Math.max(1, 10 ** Math.max(0, Math.floor(Math.log10(Math.max(max - min, 1))) - 2));
  const money = (n: number) =>
    new Intl.NumberFormat("en", { style: "currency", currency: currencyCode, maximumFractionDigits: 0 }).format(n);
  const pct = (n: number) => ((n - min) / Math.max(max - min, 1)) * 100;

  const apply = (next: { from: number; to: number }) => {
    clearTimeout(commit.current);
    commit.current = setTimeout(() => {
      if (next.from === from && next.to === to) return;
      const all = next.from <= min && next.to >= max;
      nav?.go(all ? clearHref : hrefFor.replace("PRICE", `${next.from}-${next.to}`));
    }, 400);
  };
  const set = (edge: "from" | "to", value: number) => {
    const next = edge === "from" ? { ...range, from: Math.min(value, range.to) } : { ...range, to: Math.max(value, range.from) };
    setRange(next);
    apply(next);
  };

  const thumb =
    "pointer-events-none absolute inset-0 h-6 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-orange-700 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-orange-700 [&::-webkit-slider-thumb]:shadow focus-visible:outline-none focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-orange-700 focus-visible:[&::-webkit-slider-thumb]:ring-offset-2";

  return (
    <div className="flex flex-col gap-3 px-2 pt-1">
      <p className="m-0 text-sm font-semibold text-gray-800" aria-live="polite">
        {money(range.from)} – {money(range.to)}
      </p>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-gray-300" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded bg-orange-700"
          style={{ left: `${pct(range.from)}%`, right: `${100 - pct(range.to)}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={range.from}
          onChange={(e) => set("from", Number(e.target.value))}
          aria-label="Minimum price"
          aria-valuetext={money(range.from)}
          className={thumb}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={range.to}
          onChange={(e) => set("to", Number(e.target.value))}
          aria-label="Maximum price"
          aria-valuetext={money(range.to)}
          className={thumb}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{money(min)}</span>
        <span>{money(max)}</span>
      </div>
      <noscript>
        <form className="flex items-end gap-2 text-sm">
          {Object.entries(hidden)
            .filter(([name]) => name !== "price")
            .map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
          <label className="flex flex-col gap-1">
            From
            <input
              name="price_from"
              type="number"
              min={min}
              max={max}
              defaultValue={from}
              className="h-9 w-20 rounded border border-gray-300 px-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            To
            <input
              name="price_to"
              type="number"
              min={min}
              max={max}
              defaultValue={to}
              className="h-9 w-20 rounded border border-gray-300 px-2"
            />
          </label>
          <button className="h-9 rounded bg-gray-900 px-3 font-semibold text-white">Apply</button>
        </form>
      </noscript>
    </div>
  );
}
