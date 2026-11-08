import { describe, expect, it } from "vitest";
import { VIEWED_MAX, freeShippingProgress, parseViewed, rememberViewed } from "@/features/engagement/engagement";

const eur = (centAmount: number) => ({ centAmount, currencyCode: "EUR", fractionDigits: 2 });

describe("freeShippingProgress", () => {
  it("says how much is missing, capped below 100%", () => {
    expect(freeShippingProgress(eur(2500), eur(10000))).toEqual({
      state: "remaining",
      remaining: eur(7500),
      percent: 25,
      threshold: eur(10000),
    });
    expect(freeShippingProgress(eur(9999), eur(10000))).toMatchObject({ percent: 99 });
  });
  it("says when shipping is free, and nothing without a threshold in that currency", () => {
    expect(freeShippingProgress(eur(10000), eur(10000))).toEqual({ state: "free", threshold: eur(10000) });
    expect(freeShippingProgress(eur(10), undefined)).toBeUndefined();
    expect(freeShippingProgress(eur(10), { ...eur(100), currencyCode: "GBP" })).toBeUndefined();
  });
});

describe("recently viewed", () => {
  it("keeps valid entries and drops foreign pictures", () => {
    expect(
      parseViewed(
        JSON.stringify([
          {
            slug: "air-filter",
            sku: "air-filter",
            name: "Air Filter",
            image: "https://storage.googleapis.com/merchant-center-europe/x.png",
          },
          { slug: "x", name: "X", image: "https://evil.example/x.png" },
          { slug: "Bad Slug", name: "Y" },
          "junk",
        ]),
      ),
    ).toEqual([
      { slug: "air-filter", sku: "air-filter", name: "Air Filter", image: "https://storage.googleapis.com/merchant-center-europe/x.png" },
      { slug: "x", sku: undefined, name: "X", image: undefined },
    ]);
    expect(parseViewed("not json")).toEqual([]);
  });
  it("puts the newest first, without duplicates, up to the limit", () => {
    let list = Array.from({ length: VIEWED_MAX }, (_, i) => ({ slug: `p${i}`, name: `P${i}` }));
    list = rememberViewed(list, { slug: "p5", name: "P5" });
    expect(list[0].slug).toBe("p5");
    expect(list).toHaveLength(VIEWED_MAX);
    expect(rememberViewed(list, { slug: "new", name: "N" }).at(-1)?.slug).not.toBe("p11");
  });
});
