import { describe, expect, it } from "vitest";
import type { Price, ProductProjection, ProductVariant } from "@commercetools/platform-sdk";
import {
  availableQuantity,
  categoryHref,
  formatAttributeValue,
  galleryImages,
  isQuoteOnly,
  localize,
  metaDescription,
  productHref,
  relatedProductIds,
  specRows,
  variantAxis,
} from "@/features/catalog/utils";

const variant = (id: number, sku: string, attributes: { name: string; value: unknown }[] = [], images: string[] = []): ProductVariant => ({
  id,
  sku,
  attributes,
  images: images.map((url) => ({ url, dimensions: { w: 1, h: 1 } })),
});
const product = (master: ProductVariant, variants: ProductVariant[] = []) => ({ masterVariant: master, variants }) as ProductProjection;
const price = (centAmount: number) =>
  ({ id: "p", value: { type: "centPrecision", currencyCode: "EUR", centAmount, fractionDigits: 2 } }) as Price;

describe("links", () => {
  it("builds a category path from its trail", () =>
    expect(categoryHref([{ slug: { "en-US": "excavators" } }, { slug: { "en-US": "wheeled_excavators" } }])).toBe(
      "/excavators/wheeled-excavators",
    ));
  it("puts a product at the root with its SKU", () =>
    expect(productHref({ "en-US": "JJ234_WX" }, "JJ 234")).toBe("/jj234-wx?sku=JJ%20234"));
  it("takes a plain slug", () => expect(productHref("pump")).toBe("/pump"));
});

describe("localize", () => {
  it("prefers en-US", () => expect(localize({ de: "Pumpe", "en-US": "Pump" })).toBe("Pump"));
  it("falls back to the first locale", () => expect(localize({ de: "Pumpe" })).toBe("Pumpe"));
  it("is empty without a value", () => expect(localize(undefined)).toBe(""));
});

describe("isQuoteOnly", () => {
  it("starts at €5,000", () => {
    expect(isQuoteOnly(price(499999))).toBe(false);
    expect(isQuoteOnly(price(500000))).toBe(true);
  });
  it("is false without a price", () => expect(isQuoteOnly(undefined)).toBe(false));
});

describe("attributes", () => {
  it("formats every value kind", () => {
    expect(formatAttributeValue(true)).toBe("Yes");
    expect(formatAttributeValue(12)).toBe("12");
    expect(formatAttributeValue({ key: "RED", label: "Red" })).toBe("Red");
    expect(formatAttributeValue({ key: "RED", label: { "en-US": "Red" } })).toBe("Red");
    expect(formatAttributeValue({ key: "RED" })).toBe("RED");
    expect(formatAttributeValue([1, { label: "Two" }])).toBe("1, Two");
    expect(formatAttributeValue(null)).toBe("");
  });

  it("labels spec rows and hides empty and internal ones", () =>
    expect(
      specRows(
        variant(1, "a", [
          { name: "liftCapacity", value: 900 },
          { name: "iso45001", value: false },
          { name: "relatedProducts", value: [] },
          { name: "note", value: "" },
        ]),
      ),
    ).toEqual([
      { name: "Lift Capacity", value: "900" },
      { name: "ISO 45001", value: "No" },
    ]));

  it("finds the variant axis", () => {
    const model = [{ name: "model", value: "2019" }];
    expect(variantAxis(product(variant(1, "a", model)))).toBeUndefined();
    expect(variantAxis(product(variant(1, "a", model), [variant(2, "b", model)]))).toBe("model");
  });
});

describe("galleryImages", () => {
  it("lists each image once with the variants that use it", () => {
    const p = product(variant(1, "a", [{ name: "color", value: { key: "RED", label: "Red" } }], ["x.jpg"]), [
      variant(2, "b", [{ name: "color", value: { key: "BLUE", label: "Blue" } }], ["y.jpg", "x.jpg"]),
    ]);
    expect(galleryImages(p, "color")).toEqual([
      { url: "x.jpg", skus: ["a", "b"], kind: "color", value: "Red" },
      { url: "y.jpg", skus: ["b"], kind: "color", value: "Blue" },
    ]);
  });
});

describe("relatedProductIds and availableQuantity", () => {
  it("reads the referenced ids", () =>
    expect(relatedProductIds(product(variant(1, "a", [{ name: "relatedProducts", value: [{ id: "p1" }, {}, { id: "p2" }] }])))).toEqual([
      "p1",
      "p2",
    ]));

  it("prefers the supply channel's stock", () => {
    const v = {
      ...variant(1, "a"),
      availability: { availableQuantity: 5, channels: { ch: { id: "c", version: 1, availableQuantity: 2 } } },
    } as ProductVariant;
    expect(availableQuantity(v, "ch")).toBe(2);
    expect(availableQuantity(v, "other")).toBe(5);
    expect(availableQuantity(variant(1, "a"))).toBeUndefined();
  });
});

describe("metaDescription", () => {
  it("strips markdown", () => expect(metaDescription("## Title\n\n- **Bold** [link](https://x)")).toBe("Title Bold link"));
  it("cuts at a word with an ellipsis", () => expect(metaDescription("one two three four", 12)).toBe("one two…"));
});
