import { describe, expect, it } from "vitest";
import { outOfStockMessage, outOfStockSkus, stockErrorMessage, shortfalls } from "@/features/cart/stock";

const err = (errors: unknown[]) => ({ body: { statusCode: 400, errors } });

describe("outOfStockSkus", () => {
  it("collects the SKUs of OutOfStock errors, once each", () => {
    expect(
      outOfStockSkus(
        err([
          { code: "OutOfStock", lineItems: ["l1"], skus: ["air-filter", "oil-filter"] },
          { code: "OutOfStock", lineItems: ["l2"], skus: ["air-filter"] },
        ]),
      ),
    ).toEqual(["air-filter", "oil-filter"]);
  });

  it("is undefined for other errors and junk", () => {
    expect(outOfStockSkus(err([{ code: "ConcurrentModification" }]))).toBeUndefined();
    expect(outOfStockSkus(new Error("x"))).toBeUndefined();
    expect(outOfStockSkus(undefined)).toBeUndefined();
  });

  it("tolerates a malformed skus field", () => {
    expect(outOfStockSkus(err([{ code: "OutOfStock", skus: "air-filter" }]))).toEqual([]);
    expect(outOfStockSkus(err([{ code: "OutOfStock", skus: ["a", 3, null] }]))).toEqual(["a"]);
  });
});

describe("outOfStockMessage", () => {
  it("names one or several SKUs", () => {
    expect(outOfStockMessage(["air-filter"])).toBe(
      "Not enough stock for air-filter. Lower the quantity or remove it from your cart, then try again.",
    );
    expect(outOfStockMessage(["a", "b"])).toContain("for a, b. Lower the quantity or remove them");
  });

  it("shortens long lists and handles none", () => {
    expect(outOfStockMessage(["a", "b", "c", "d", "e", "f", "g"])).toContain("for a, b, c, d, e and 2 more.");
    expect(outOfStockMessage([])).toBe("Some items in your cart are no longer in stock. Please review your cart.");
  });
});

describe("stockErrorMessage", () => {
  it("gives a message only for out-of-stock errors", () => {
    expect(stockErrorMessage(err([{ code: "OutOfStock", skus: ["x"] }]))).toContain("Not enough stock for x.");
    expect(stockErrorMessage(err([{ code: "InvalidOperation" }]))).toBeUndefined();
  });
});

describe("shortfalls", () => {
  const entry = (sku: string, availableQuantity: number, channel = "c1") => ({ sku, availableQuantity, supplyChannel: { id: channel } });
  it("finds SKUs the channel can't fill", () => {
    expect(shortfalls([{ sku: "A", channel: "c1", quantity: 3 }], [entry("A", 2)])).toEqual(["A"]);
    expect(shortfalls([{ sku: "A", channel: "c1", quantity: 2 }], [entry("A", 2)])).toEqual([]);
  });
  it("counts lines of one SKU together", () => {
    const lines = [
      { sku: "A", channel: "c1", quantity: 2 },
      { sku: "A", channel: "c1", quantity: 2 },
    ];
    expect(shortfalls(lines, [entry("A", 3)])).toEqual(["A"]);
  });
  it("reads the line's own channel", () => {
    expect(shortfalls([{ sku: "A", channel: "c2", quantity: 1 }], [entry("A", 0), entry("A", 5, "c2")])).toEqual([]);
  });
  it("leaves a SKU without a stock entry to commercetools", () => {
    expect(shortfalls([{ sku: "A", channel: "c1", quantity: 1 }], [])).toEqual([]);
  });
});
