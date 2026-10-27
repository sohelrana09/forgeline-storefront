import type { ProductProjection } from "@commercetools/platform-sdk";
import { describe, expect, it } from "vitest";
import { catalogHref, layer, parseFilters, parseLimit, parseSort, type CategoryOption } from "@/features/catalog/layered";

const eur = (euros: number) => ({ type: "centPrecision" as const, centAmount: euros * 100, currencyCode: "EUR", fractionDigits: 2 });

// Only the fields the layered navigation reads.
function product(
  name: string,
  price: number | undefined,
  variants: { model?: number; color?: string; mobility?: string; iso?: boolean; capacity?: number }[],
  { category = "leaf-a", createdAt = "2026-01-01T00:00:00Z" } = {},
): ProductProjection {
  const toVariant = (v: (typeof variants)[number], i: number) => ({
    id: i + 1,
    sku: `${name}-${i}`,
    ...(i === 0 && price !== undefined && { price: { value: eur(price) } }),
    attributes: [
      ...(v.model !== undefined ? [{ name: "model", value: v.model }] : []),
      ...(v.color ? [{ name: "color", value: { key: v.color, label: { "en-US": v.color } } }] : []),
      ...(v.mobility ? [{ name: "mobility", value: { key: v.mobility, label: v.mobility[0].toUpperCase() + v.mobility.slice(1) } }] : []),
      ...(v.iso !== undefined ? [{ name: "iso45001", value: v.iso }] : []),
      ...(v.capacity !== undefined ? [{ name: "capacity", value: v.capacity }] : []),
    ],
  });
  const [master, ...rest] = variants.map(toVariant);
  return {
    id: name,
    name: { "en-US": name },
    createdAt,
    categories: [{ typeId: "category", id: category }],
    masterVariant: master,
    variants: rest,
  } as unknown as ProductProjection;
}

const loader = product("Loader", 24_000, [
  { model: 2015, mobility: "wheeled", iso: true, capacity: 700 },
  { model: 2023, mobility: "wheeled", iso: true, capacity: 700 },
]);
const excavator = product("Excavator", 41_000, [{ model: 2019, mobility: "tracked", iso: false, capacity: 12_000 }], {
  category: "leaf-b",
});
const crane = product(
  "Crane",
  18_500,
  [
    { color: "RED", mobility: "tracked", iso: true, capacity: 600 },
    { color: "BLUE", mobility: "tracked", iso: true, capacity: 600 },
  ],
  {
    createdAt: "2026-06-01T00:00:00Z",
  },
);
const all = [loader, excavator, crane];
const categories: CategoryOption[] = [
  { slug: "loaders", name: "Loaders", ids: new Set(["leaf-a"]) },
  { slug: "excavators", name: "Excavators", ids: new Set(["leaf-b"]) },
];

describe("parse", () => {
  it("reads the slider's plain form (From / To) as a price filter", () => {
    expect(parseFilters({ price_from: "100", price_to: "250.4" })).toEqual({ price: "100-250" });
    expect(parseFilters({ price_from: "-5", price_to: "abc" })).toEqual({});
  });
  it("keeps known filters with plain values only", () => {
    expect(parseFilters({ mobility: "Tracked", model: ["2019", "2015"], evil: "x", color: "red<script>" })).toEqual({
      mobility: "tracked",
      model: "2019",
    });
  });
  it("falls back to the default sort and page size", () => {
    expect(parseSort("price-desc")).toBe("price-desc");
    expect(parseSort("hacked")).toBe("name-asc");
    expect(parseLimit("48")).toBe(48);
    expect(parseLimit("1000")).toBe(24);
  });
});

describe("layer", () => {
  it("counts each option once per product and hides options every product shares", () => {
    const { facets, products } = layer(all, {}, "name-asc", categories);
    expect(products.map((p) => p.id)).toEqual(["Crane", "Excavator", "Loader"]);
    const mobility = facets.find((f) => f.key === "mobility")!;
    expect(mobility.options).toEqual([
      { value: "tracked", label: "Tracked", count: 2 },
      { value: "wheeled", label: "Wheeled", count: 1 },
    ]);
    expect(facets.find((f) => f.key === "model")!.options.map((o) => [o.value, o.count])).toEqual([
      ["2023", 1],
      ["2019", 1],
      ["2015", 1],
    ]);
    expect(facets.find((f) => f.key === "cat")!.options).toEqual([
      { value: "loaders", label: "Loaders", count: 2 },
      { value: "excavators", label: "Excavators", count: 1 },
    ]);
  });

  it("needs one variant to match every attribute filter", () => {
    expect(layer(all, { model: "2023", mobility: "wheeled" }, "name-asc", categories).products.map((p) => p.id)).toEqual(["Loader"]);
    expect(layer(all, { model: "2023", mobility: "tracked" }, "name-asc", categories).products).toEqual([]);
    expect(layer(all, { color: "blue" }, "name-asc", categories).products.map((p) => p.id)).toEqual(["Crane"]);
  });

  it("gives the price slider the full range of the other filters' products, both ends included", () => {
    const { price } = layer(all, {}, "name-asc", categories);
    expect(price).toEqual({ min: 18500, max: 41000, from: 18500, to: 41000, currencyCode: "EUR", fractionDigits: 2 });
    // Selecting a price keeps the track (the range ignores the price filter itself) and moves the handles.
    const narrowed = layer(all, { price: "20000-24000" }, "name-asc", categories);
    expect(narrowed.products.map((p) => p.id)).toEqual(["Loader"]); // 24,000 itself is included
    expect(narrowed.price).toMatchObject({ min: 18500, max: 41000, from: 20000, to: 24000 });
    expect(narrowed.applied[0]).toMatchObject({ key: "price", valueLabel: "€20,000.00 - €24,000.00" });
    // Other filters do narrow the track.
    expect(layer(all, { mobility: "tracked" }, "name-asc", categories).price).toMatchObject({ min: 18500, max: 41000 });
    expect(layer(all, { mobility: "wheeled" }, "name-asc", categories).price).toBeUndefined(); // one product, one price
  });

  it("lists applied filters with labels and leaves them out of the sidebar", () => {
    const result = layer(all, { mobility: "tracked", cat: "loaders" }, "name-asc", categories);
    expect(result.products.map((p) => p.id)).toEqual(["Crane"]);
    expect(result.applied).toEqual([
      { key: "cat", label: "Category", value: "loaders", valueLabel: "Loaders" },
      { key: "mobility", label: "Mobility", value: "tracked", valueLabel: "Tracked" },
    ]);
    expect(result.facets.map((f) => f.key)).not.toContain("mobility");
    expect(result.facets.map((f) => f.key)).not.toContain("cat");
  });

  it("sorts by price both ways, unpriced last, and by newest", () => {
    const unpriced = product("Mystery", undefined, [{ mobility: "fixed" }]);
    const list = [...all, unpriced];
    expect(layer(list, {}, "price-asc", categories).products.map((p) => p.id)).toEqual(["Crane", "Loader", "Excavator", "Mystery"]);
    expect(layer(list, {}, "price-desc", categories).products.map((p) => p.id)).toEqual(["Excavator", "Loader", "Crane", "Mystery"]);
    expect(layer(all, {}, "newest", categories).products[0].id).toBe("Crane");
  });
});

describe("catalogHref", () => {
  const state = { filters: { mobility: "tracked" }, sort: "price-desc" as const, limit: 24, page: 3 };
  it("leaves defaults out and starts again at page 1 when the list changes", () => {
    expect(catalogHref("/excavators", state)).toBe("/excavators?mobility=tracked&sort=price-desc&page=3");
    expect(catalogHref("/excavators", state, { filters: { mobility: "tracked", model: "2019" } })).toBe(
      "/excavators?mobility=tracked&model=2019&sort=price-desc",
    );
    expect(catalogHref("/excavators", { filters: {}, sort: "name-asc", limit: 24 })).toBe("/excavators");
  });
});
