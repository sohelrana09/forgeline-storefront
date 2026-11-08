import { describe, expect, it } from "vitest";
import { listingFromSearch, listingSearchRequest, MAX_OFFSET, priceFilter, type ListingSearchInput } from "./listing-search";

const base: ListingSearchInput = {
  categoryId: "cat-root",
  storeId: "store-1",
  currency: "EUR",
  channelId: "chan-1",
  filters: {},
  sort: "name-asc",
  offset: 0,
  limit: 24,
  locale: "en-US",
  categories: [
    { slug: "loaders", name: "Loaders", id: "cat-a" },
    { slug: "graders", name: "Graders", id: "cat-b" },
  ],
  machines: [
    { slug: "s567-uv", name: "S567 UV", productIds: ["p1", "p2"] },
    { slug: "jj234-wx", name: "JJ234 WX", productIds: ["p2", "p3"] },
  ],
  shownMachines: ["s567-uv"],
};

const json = (v: unknown) => JSON.stringify(v);
type Facet = {
  distinct?: { name: string; filter?: unknown };
  ranges?: { name: string };
  stats?: { name: string };
  count?: { name: string };
};
const facetNames = (facets: Facet[]) => facets.map((f) => (f.distinct ?? f.ranges ?? f.stats ?? f.count)!.name);

describe("listingSearchRequest", () => {
  it("lists the store's products in the category subtree, sorted by name", () => {
    const req = listingSearchRequest(base)!;
    expect(req.query).toEqual({
      and: [{ exact: { field: "stores", value: "store-1" } }, { exact: { field: "categoriesSubTree", value: "cat-root" } }],
    });
    expect(req.postFilter).toBeUndefined();
    expect(req.sort[0]).toEqual({ field: "name", language: "en-US", order: "asc" });
    expect(facetNames(req.facets as Facet[])).toEqual([
      "cat",
      "fits",
      "mobility",
      "color",
      "model",
      "iso45001",
      "capacity",
      "price",
      "total",
    ]);
  });

  it("puts attribute filters in one variant-level and, enum keys case-insensitive", () => {
    const req = listingSearchRequest({ ...base, filters: { color: "red", model: "2019", iso45001: "yes", capacity: "1000-9999" } })!;
    const text = json(req.query);
    expect(text).toContain('"field":"variants.attributes.color.key","value":"red","fieldType":"lenum","caseInsensitive":true');
    expect(text).toContain('"field":"variants.attributes.model","value":2019,"fieldType":"number"');
    expect(text).toContain('"field":"variants.attributes.iso45001","value":true,"fieldType":"boolean"');
    expect(text).toContain('"gte":1000,"lt":10000');
    // Applied filters drop their own facet.
    expect(facetNames(req.facets as Facet[])).not.toContain("color");
  });

  it("filters child categories and machines, and refuses unknown values", () => {
    expect(json(listingSearchRequest({ ...base, filters: { cat: "graders" } })!.query)).toContain('"value":"cat-b"');
    expect(json(listingSearchRequest({ ...base, filters: { fits: "jj234-wx" } })!.query)).toContain('{"field":"id","values":["p2","p3"]}');
    expect(listingSearchRequest({ ...base, filters: { cat: "nope" } })).toBeUndefined();
    expect(listingSearchRequest({ ...base, filters: { fits: "nope" } })).toBeUndefined();
  });

  it("puts price in postFilter and repeats it on facets, not on the slider's stats", () => {
    const req = listingSearchRequest({ ...base, filters: { price: "100-200" } })!;
    expect(req.postFilter).toEqual(priceFilter({ ...base, filters: { price: "100-200" } }));
    expect(json(req.postFilter)).toContain('"gte":10000,"lte":20000');
    const facets = req.facets as Facet[];
    expect(facets.find((f) => f.distinct?.name === "mobility")!.distinct!.filter).toEqual(req.postFilter);
    expect(json(facets.find((f) => f.stats))).not.toContain('currentCentAmount","gte');
  });

  it("scopes price sorting to the visitor's currency and channel", () => {
    const req = listingSearchRequest({ ...base, sort: "price-desc" })!;
    expect(req.sort[0]).toMatchObject({ field: "variants.prices.currentCentAmount", order: "desc", mode: "min" });
    expect(json(req.sort[0])).toContain('"value":"chan-1"');
    expect(listingSearchRequest({ ...base, sort: "newest" })!.sort[0]).toEqual({ field: "createdAt", order: "desc" });
  });

  it("honours currencies without cents and caps the offset", () => {
    expect(json(priceFilter({ ...base, currency: "JPY", filters: { price: "300-" } }))).toContain('"gte":300}');
    expect(listingSearchRequest({ ...base, offset: 20_000 })!.offset).toBe(MAX_OFFSET);
  });
});

describe("listingFromSearch", () => {
  const res = {
    total: 12,
    results: [{ id: "p2" }, { id: "p1" }],
    facets: [
      {
        name: "cat",
        buckets: [
          { key: "cat-a", count: 7 },
          { key: "cat-b", count: 0 },
        ],
      },
      {
        name: "fits",
        buckets: [
          { key: "p1", count: 1 },
          { key: "p2", count: 1 },
        ],
      },
      {
        name: "mobility",
        buckets: [
          { key: "tracked", count: 5 },
          { key: "wheeled", count: 7 },
        ],
      },
      { name: "color", buckets: [{ key: "RED", count: 12 }] },
      {
        name: "model",
        buckets: [
          { key: "2019", count: 4 },
          { key: "2021", count: 8 },
        ],
      },
      {
        name: "iso45001",
        buckets: [
          { key: "false", count: 3 },
          { key: "true", count: 9 },
        ],
      },
      {
        name: "capacity",
        buckets: [
          { key: "10000-", count: 2 },
          { key: "0-499", count: 10 },
        ],
      },
      { name: "price", min: 1050, max: 99999, count: 12 },
      { name: "total", value: 12 },
    ],
  };

  it("maps buckets to the same facets as the in-memory listing", () => {
    const out = listingFromSearch(res, base, { mobility: { tracked: "Tracked", wheeled: "Wheeled" }, color: { red: "RED" } });
    expect(out.ids).toEqual(["p2", "p1"]);
    expect(out.facets.map((f) => f.key)).toEqual(["fits", "cat", "mobility", "model", "iso45001", "capacity"]);
    expect(out.facets.find((f) => f.key === "fits")!.options).toEqual([{ value: "s567-uv", label: "S567 UV", count: 2 }]);
    expect(out.facets.find((f) => f.key === "cat")!.options).toEqual([{ value: "loaders", label: "Loaders", count: 7 }]);
    expect(out.facets.find((f) => f.key === "model")!.options.map((o) => o.value)).toEqual(["2021", "2019"]);
    expect(out.facets.find((f) => f.key === "iso45001")!.options[0]).toEqual({ value: "yes", label: "Yes", count: 9 });
    expect(out.facets.find((f) => f.key === "capacity")!.options[0].label).toBe("Under 500");
    expect(out.price).toMatchObject({ min: 10, max: 1000, from: 10, to: 1000, currencyCode: "EUR" });
  });

  it("labels applied filters and clamps the selected price", () => {
    const filters = { price: "5-200", fits: "s567-uv", mobility: "tracked" };
    const out = listingFromSearch(res, { ...base, filters }, { mobility: { tracked: "Tracked" } });
    expect(out.applied.map((a) => `${a.label}: ${a.valueLabel}`)).toEqual([
      expect.stringMatching(/^Price: €5.00 - €200.00$/),
      "Fits: S567 UV",
      "Mobility: Tracked",
    ]);
    expect(out.price).toMatchObject({ from: 10, to: 200 });
    expect(out.facets.map((f) => f.key)).not.toContain("fits");
  });
});
