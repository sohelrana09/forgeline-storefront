import { afterEach, describe, expect, it, vi } from "vitest";
import { productSearchEnabled, productSearchRequest } from "@/features/catalog/product-search";

const pricing = { storeId: "store-1", storeKey: "spain", currency: "EUR", channelId: "ch-1", country: "ES" };
const opts = { offset: 20, limit: 10, locale: "en-US" };

afterEach(() => vi.unstubAllEnvs());

describe("productSearchRequest", () => {
  it("is nothing for an empty query", () => expect(productSearchRequest(" - ", pricing, opts)).toBeUndefined());

  it("filters by store and needs every word to match", () => {
    const body = productSearchRequest("Air filter", pricing, opts)!;
    const and = (body.query as { and: unknown[] }).and;
    expect(and[0]).toEqual({ exact: { field: "stores", value: "store-1" } });
    expect(and).toHaveLength(3);
    expect(JSON.stringify(and[1])).toContain('"value":"air"');
  });

  it("allows typos only in longer words", () => {
    const fuzzy = (q: string) =>
      JSON.stringify(productSearchRequest(q, { ...pricing, storeId: undefined }, opts)!.query).match(/"level":(\d)/)?.[1];
    expect(fuzzy("pump")).toBe("1");
    expect(fuzzy("excavator")).toBe("2");
    expect(fuzzy("kit")).toBeUndefined();
  });

  it("prices the hits like the cards and pages them", () => {
    const body = productSearchRequest("pump", { ...pricing, customerGroupId: "g-1" }, opts)!;
    expect(body).toMatchObject({ offset: 20, limit: 10 });
    expect(body.productProjectionParameters).toEqual({
      storeProjection: "spain",
      priceCurrency: "EUR",
      priceChannel: "ch-1",
      priceCountry: "ES",
      priceCustomerGroup: "g-1",
    });
  });
});

describe("productSearchEnabled", () => {
  it("is off unless CATALOG_SEARCH=product-search", () => {
    vi.stubEnv("CATALOG_SEARCH", "");
    expect(productSearchEnabled()).toBe(false);
    vi.stubEnv("CATALOG_SEARCH", "product-search");
    expect(productSearchEnabled()).toBe(true);
  });
});
