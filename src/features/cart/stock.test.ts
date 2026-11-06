import { describe, expect, it } from "vitest";
import { outOfStockMessage, outOfStockSkus, stockErrorMessage } from "@/features/cart/stock";

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
