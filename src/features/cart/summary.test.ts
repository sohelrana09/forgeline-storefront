import { describe, expect, it } from "vitest";
import type { Cart } from "@commercetools/platform-sdk";
import { summarize } from "@/features/cart/summary";

const eur = (centAmount: number) => ({ type: "centPrecision" as const, currencyCode: "EUR", centAmount, fractionDigits: 2 });
const cart = (extra: Partial<Cart>, includedInPrice = true) =>
  ({
    lineItems: [{ quantity: 2, totalPrice: eur(10000), taxRate: { includedInPrice } }],
    totalPrice: eur(9000),
    ...extra,
  }) as unknown as Cart;

describe("summarize: discount on the total", () => {
  it("has no discount row without one", () => {
    expect(summarize(cart({})).discount).toBeUndefined();
  });

  it("uses the gross amount when prices include tax", () => {
    const d = { discountedAmount: eur(1000), discountedGrossAmount: eur(1000), discountedNetAmount: eur(840), includedDiscounts: [] };
    expect(summarize(cart({ discountOnTotalPrice: d })).discount).toBe(1000);
  });

  it("uses the net amount when tax is added on top, else the plain amount", () => {
    const d = { discountedAmount: eur(1000), discountedNetAmount: eur(840), includedDiscounts: [] };
    expect(summarize(cart({ discountOnTotalPrice: d }, false)).discount).toBe(840);
    expect(summarize(cart({ discountOnTotalPrice: { discountedAmount: eur(500), includedDiscounts: [] } }, false)).discount).toBe(500);
  });
});
