// Category listings through the commercetools Product Search API (docs/features/search-scaling.md), for catalogs past
// what the in-memory layered navigation (layered.ts, CATEGORY_MAX) handles. Same URL state, filters, facets, sorting
// and output shape as `layer()`, so CategoryView renders either. Pure: request bodies and response mapping only
// (listing-search.test.ts); the call is in catalog/service.ts.
//
// Mapping:
// - The listing is the store's assortment (`stores`) in the category's subtree (`categoriesSubTree`).
// - Filters other than price go in `query`; price goes in `postFilter`, so the price slider's range (a stats facet)
//   ignores the price filter like the in-memory one. Every other facet repeats the price filter in its own `filter`,
//   so its counts match the listed products.
// - Price is `variants.prices.currentCentAmount` (the discounted price when a discount applies, as cards show it),
//   scoped to the visitor's currency and channel. Standalone prices are searchable as they are.
// - Attribute filters are variant-level criteria in one `and`, so one variant must satisfy them all (like layered.ts).
import type { SearchQuery } from "@commercetools/platform-sdk";
import { formatMoney } from "@/lib/utils";
import { CAPACITY_BUCKETS, SORTS, type Facet, type Filters, type Layered, type PriceRange, type SortKey } from "@/features/catalog/layered";

export type ListingCategory = { slug: string; name: string; id: string };
export type ListingMachine = { slug: string; name: string; productIds: string[] };

export type ListingSearchInput = {
  categoryId: string;
  storeId: string;
  currency: string;
  channelId?: string;
  filters: Filters;
  sort: SortKey;
  offset: number;
  limit: number;
  locale: string;
  categories: ListingCategory[];
  // Fitment: every machine (a ?fits link works for anyone) and the slugs of the company's equipment (the facet).
  machines?: ListingMachine[];
  shownMachines?: string[];
};

// Labels of enum and lenum keys by lower-case key, from the product types (Product Search returns keys only).
export type AttributeLabels = Partial<Record<"mobility" | "color", Record<string, string>>>;

// The Product Search API's own JSON (a subset): `query`, `postFilter`, `facets`, `sort`.
export type ListingSearchRequest = {
  query: SearchQuery;
  postFilter?: SearchQuery;
  sort: Record<string, unknown>[];
  facets: Record<string, unknown>[];
  limit: number;
  offset: number;
};

// Limits of the API: 100 values per exact, offset up to 9,900.
const MAX_VALUES = 100;
export const MAX_OFFSET = 9_900;

export const fractionDigits = (currency: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;

const exact = (field: string, value: string | boolean | number, fieldType?: string): SearchQuery =>
  ({ exact: { field, value, ...(fieldType && { fieldType }) } }) as SearchQuery;
// Enum keys: URLs carry them in lower case (layered.ts), the data has both (`tracked`, `RED`).
const exactKey = (field: string, value: string, fieldType: string): SearchQuery =>
  ({ exact: { field, value, fieldType, caseInsensitive: true } }) as SearchQuery;
const exactAny = (field: string, values: string[]): SearchQuery =>
  ({ exact: { field, values: values.slice(0, MAX_VALUES) } }) as SearchQuery;
const and = (parts: SearchQuery[]): SearchQuery => (parts.length === 1 ? parts[0] : ({ and: parts } as SearchQuery));

// The visitor's price rows: their currency, and their store's channel when it has one.
const priceScope = (input: ListingSearchInput): SearchQuery[] => [
  exact("variants.prices.currencyCode", input.currency),
  ...(input.channelId ? [exact("variants.prices.channel", input.channelId)] : []),
];

export function priceFilter(input: ListingSearchInput): SearchQuery | undefined {
  const range = input.filters.price;
  if (!range) return undefined;
  const [from, to] = range.split("-");
  const scale = 10 ** fractionDigits(input.currency);
  const bounds = {
    ...(from !== "" && Number.isFinite(Number(from)) && { gte: Math.round(Number(from) * scale) }),
    // Both ends included, like layered.ts: up to the last cent of `to`.
    ...(to !== "" && to !== undefined && Number.isFinite(Number(to)) && { lte: Math.round(Number(to) * scale) }),
  };
  return and([...priceScope(input), { range: { field: "variants.prices.currentCentAmount", ...bounds } } as SearchQuery]);
}

function attributeFilters(filters: Filters): SearchQuery[] {
  const parts: SearchQuery[] = [];
  if (filters.mobility) parts.push(exactKey("variants.attributes.mobility.key", filters.mobility, "enum"));
  if (filters.color) parts.push(exactKey("variants.attributes.color.key", filters.color, "lenum"));
  if (filters.model && /^\d+$/.test(filters.model)) parts.push(exact("variants.attributes.model", Number(filters.model), "number"));
  if (filters.iso45001) parts.push(exact("variants.attributes.iso45001", filters.iso45001 === "yes", "boolean"));
  if (filters.capacity) {
    const bucket = CAPACITY_BUCKETS.find((b) => b.value === filters.capacity);
    if (bucket)
      parts.push({
        range: {
          field: "variants.attributes.capacity",
          fieldType: "number",
          gte: bucket.from,
          ...(Number.isFinite(bucket.to) && { lt: bucket.to }),
        },
      } as SearchQuery);
  }
  // Variant-level criteria together: one variant must match all of them.
  return parts.length > 1 ? [{ and: parts } as SearchQuery] : parts;
}

// undefined: a filter value that can't match (an unknown child category or machine), so the listing is empty.
export function listingSearchRequest(input: ListingSearchInput): ListingSearchRequest | undefined {
  const { filters } = input;
  const query: SearchQuery[] = [exact("stores", input.storeId), exact("categoriesSubTree", input.categoryId)];
  if (filters.cat) {
    const cat = input.categories.find((c) => c.slug === filters.cat);
    if (!cat) return undefined;
    query.push(exact("categoriesSubTree", cat.id));
  }
  if (filters.fits) {
    const machine = input.machines?.find((m) => m.slug === filters.fits);
    if (!machine || machine.productIds.length === 0) return undefined;
    query.push(exactAny("id", machine.productIds));
  }
  query.push(...attributeFilters(filters));
  const price = priceFilter(input);
  const withPrice = price && { filter: price };

  const facets: Record<string, unknown>[] = [];
  if (!filters.cat && input.categories.length > 0) {
    facets.push({
      distinct: {
        name: "cat",
        field: "categoriesSubTree",
        includes: input.categories.map((c) => c.id).slice(0, MAX_VALUES),
        limit: input.categories.length,
        ...withPrice,
      },
    });
  }
  const shown = (input.machines ?? []).filter((m) => input.shownMachines?.includes(m.slug));
  if (!filters.fits && shown.length > 0) {
    const ids = [...new Set(shown.flatMap((m) => m.productIds))].slice(0, MAX_VALUES);
    facets.push({ distinct: { name: "fits", field: "id", includes: ids, limit: ids.length, ...withPrice } });
  }
  const distinct = (name: string, field: string, fieldType: string) =>
    facets.push({ distinct: { name, field, fieldType, limit: 50, count: "products", ...withPrice } });
  if (!filters.mobility) distinct("mobility", "variants.attributes.mobility.key", "enum");
  if (!filters.color) distinct("color", "variants.attributes.color.key", "lenum");
  if (!filters.model) distinct("model", "variants.attributes.model", "number");
  if (!filters.iso45001) distinct("iso45001", "variants.attributes.iso45001", "boolean");
  if (!filters.capacity)
    facets.push({
      ranges: {
        name: "capacity",
        field: "variants.attributes.capacity",
        fieldType: "number",
        ranges: CAPACITY_BUCKETS.map((b) => ({ key: b.value, from: b.from, ...(Number.isFinite(b.to) && { to: b.to }) })),
        ...withPrice,
      },
    });
  // The slider's track: the visitor's prices among the products matching every other filter (postFilter excluded).
  facets.push({ stats: { name: "price", field: "variants.prices.currentCentAmount", filter: and(priceScope(input)) } });
  facets.push({ count: { name: "total", ...withPrice } });

  return {
    query: and(query),
    ...(price && { postFilter: price }),
    sort: sortFor(input),
    facets,
    limit: input.limit,
    offset: Math.min(input.offset, MAX_OFFSET),
  };
}

function sortFor(input: ListingSearchInput): Record<string, unknown>[] {
  const { field, dir } = SORTS[input.sort];
  const tieBreak = { field: "id", order: "asc" };
  if (field === "newest") return [{ field: "createdAt", order: "desc" }, tieBreak];
  if (field === "price")
    return [
      { field: "variants.prices.currentCentAmount", order: dir, mode: "min", filter: and(priceScope(input)) },
      { field: "name", language: input.locale, order: "asc" },
      tieBreak,
    ];
  return [{ field: "name", language: input.locale, order: dir }, tieBreak];
}

// ---------- Response ----------

type Bucket = { key: string; count: number };
export type ListingSearchResponse = {
  total: number;
  results: { id: string }[];
  facets?: ({ name: string; buckets?: Bucket[] } & { min?: number; max?: number; value?: number })[];
};

const ATTRIBUTE_LABELS = {
  mobility: "Mobility",
  model: "Model year",
  color: "Color",
  iso45001: "ISO 45001 certified",
  capacity: "Capacity",
};

export type ListingSearchResult = Omit<Layered, "products"> & { ids: string[]; total: number };

const capitalize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export function listingFromSearch(res: ListingSearchResponse, input: ListingSearchInput, labels: AttributeLabels): ListingSearchResult {
  const { filters } = input;
  const facet = (name: string) => res.facets?.find((f) => f.name === name);
  const buckets = (name: string) => (facet(name)?.buckets ?? []).filter((b) => b.count > 0);
  // Products matching the filters, for "can this facet narrow the list?" (as layered.ts: hide it when it can't).
  const matching = facet("total")?.value ?? res.total;
  const facets: Facet[] = [];

  if (!filters.fits) {
    const counts = new Map(buckets("fits").map((b) => [b.key, b.count]));
    const options = (input.machines ?? [])
      .filter((m) => input.shownMachines?.includes(m.slug))
      .map((m) => ({ value: m.slug, label: m.name, count: m.productIds.reduce((n, id) => n + (counts.get(id) ?? 0), 0) }))
      .filter((o) => o.count > 0);
    if (options.length > 0) facets.push({ key: "fits", label: "Fits my equipment", options });
  }
  if (!filters.cat) {
    const counts = new Map(buckets("cat").map((b) => [b.key, b.count]));
    const options = input.categories
      .map((c) => ({ value: c.slug, label: c.name, count: counts.get(c.id) ?? 0 }))
      .filter((o) => o.count > 0);
    if (options.length > 0) facets.push({ key: "cat", label: "Category", options });
  }

  const label = (key: keyof typeof ATTRIBUTE_LABELS, value: string): string => {
    if (key === "mobility") return labels.mobility?.[value] ?? value;
    if (key === "color") return capitalize(labels.color?.[value] ?? value);
    if (key === "iso45001") return value === "true" || value === "yes" ? "Yes" : "No";
    if (key === "capacity") return CAPACITY_BUCKETS.find((b) => b.value === value)?.label ?? value;
    return value;
  };
  // Bucket keys as URL values: enum keys lower case (like layered.ts), booleans yes/no.
  const urlValue = (key: string, bucket: string) =>
    key === "iso45001" ? (bucket === "true" ? "yes" : "no") : key === "model" ? String(Math.round(Number(bucket))) : bucket.toLowerCase();
  const order: Partial<Record<string, (a: string, b: string) => number>> = {
    model: (a, b) => Number(b) - Number(a),
    iso45001: (a) => (a === "yes" ? -1 : 1),
    capacity: (a, b) => parseInt(a, 10) - parseInt(b, 10),
  };
  for (const key of ["mobility", "model", "color", "iso45001", "capacity"] as const) {
    if (filters[key]) continue;
    const options = buckets(key).map((b) => {
      const value = urlValue(key, b.key);
      return { value, label: label(key, value), count: b.count };
    });
    const sorted = options.sort((a, b) => order[key]?.(a.value, b.value) ?? a.label.localeCompare(b.label));
    if (sorted.some((o) => o.count < matching)) facets.push({ key, label: ATTRIBUTE_LABELS[key], options: sorted });
  }

  const digits = fractionDigits(input.currency);
  const stats = facet("price");
  let price: PriceRange | undefined;
  if (stats && typeof stats.min === "number" && typeof stats.max === "number") {
    const min = Math.floor(stats.min / 10 ** digits);
    const max = Math.ceil(stats.max / 10 ** digits);
    if (min !== max || filters.price) {
      const [from, to] = (filters.price ?? "").split("-");
      const clamp = (raw: string | undefined, fallback: number) =>
        raw === undefined || raw === "" || !Number.isFinite(Number(raw)) ? fallback : Math.min(Math.max(Number(raw), min), max);
      price = { min, max, from: clamp(from, min), to: clamp(to, max), currencyCode: input.currency, fractionDigits: digits };
    }
  }

  const applied: Layered["applied"] = [];
  const money = (n: string) =>
    formatMoney({ currencyCode: input.currency, fractionDigits: digits, centAmount: Math.round(Number(n) * 10 ** digits) });
  for (const [key, value] of Object.entries(filters) as [keyof Filters, string][]) {
    if (!value) continue;
    if (key === "fits")
      applied.push({ key, label: "Fits", value, valueLabel: input.machines?.find((m) => m.slug === value)?.name ?? value });
    else if (key === "cat")
      applied.push({ key, label: "Category", value, valueLabel: input.categories.find((c) => c.slug === value)?.name ?? value });
    else if (key === "price") {
      const [from, to] = value.split("-");
      applied.push({ key, label: "Price", value, valueLabel: to ? `${money(from)} - ${money(to)}` : `${money(from)} and above` });
    } else applied.push({ key, label: ATTRIBUTE_LABELS[key], value, valueLabel: label(key, value) });
  }

  return { ids: res.results.map((r) => r.id), total: res.total, facets, applied, price };
}
