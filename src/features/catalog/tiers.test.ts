import { describe, expect, it } from "vitest";
import type { Price, TypedMoney } from "@commercetools/platform-sdk";
import { lowestUnitPrice, nextStep, priceSteps, savingPercent, unitPriceAt } from "@/features/catalog/tiers";

const usd = (centAmount: number): TypedMoney => ({ type: "centPrecision", currencyCode: "USD", centAmount, fractionDigits: 2 });
const price = (value: number, tiers: [number, number][] = [], discounted?: number): Price => ({
  id: "p",
  key: "k",
  value: usd(value),
  tiers: tiers.map(([minimumQuantity, v]) => ({ minimumQuantity, value: usd(v) })),
  ...(discounted && { discounted: { value: usd(discounted), discount: { typeId: "product-discount", id: "d" } } }),
});

describe("priceSteps", () => {
  it("starts with the base price and sorts the tiers by quantity", () => {
    const steps = priceSteps(
      price(4000, [
        [50, 3200],
        [10, 3600],
      ]),
    );
    expect(steps.map((s) => [s.minimumQuantity, s.value.centAmount])).toEqual([
      [1, 4000],
      [10, 3600],
      [50, 3200],
    ]);
  });

  it("is just the base price without tiers", () => {
    expect(priceSteps(price(4000))).toHaveLength(1);
  });
});

describe("unitPriceAt", () => {
  const p = price(4000, [
    [10, 3600],
    [50, 3200],
  ]);

  it("uses the highest tier the quantity reaches", () => {
    expect(unitPriceAt(p, 1).centAmount).toBe(4000);
    expect(unitPriceAt(p, 9).centAmount).toBe(4000);
    expect(unitPriceAt(p, 10).centAmount).toBe(3600);
    expect(unitPriceAt(p, 49).centAmount).toBe(3600);
    expect(unitPriceAt(p, 500).centAmount).toBe(3200);
  });

  it("uses the discounted value when a product discount applies", () => {
    expect(unitPriceAt(price(4000, [[10, 3600]], 3000), 20).centAmount).toBe(3000);
  });
});

describe("nextStep", () => {
  const p = price(4000, [
    [10, 3600],
    [50, 3200],
  ]);

  it("finds the next break above the quantity", () => {
    expect(nextStep(p, 3)?.minimumQuantity).toBe(10);
    expect(nextStep(p, 10)?.minimumQuantity).toBe(50);
  });

  it("is undefined at the top tier, without tiers and with a discount", () => {
    expect(nextStep(p, 50)).toBeUndefined();
    expect(nextStep(price(4000), 1)).toBeUndefined();
    expect(nextStep(price(4000, [[10, 3600]], 3000), 1)).toBeUndefined();
  });
});

describe("lowestUnitPrice and savingPercent", () => {
  it("finds the cheapest step", () => {
    expect(
      lowestUnitPrice(
        price(4000, [
          [10, 3600],
          [50, 3200],
        ]),
      ).centAmount,
    ).toBe(3200);
  });

  it("rounds the saving down", () => {
    expect(savingPercent(usd(4000), usd(3600))).toBe(10);
    expect(savingPercent(usd(2750), usd(2475))).toBe(10);
    expect(savingPercent(usd(7500), usd(6250))).toBe(16);
  });
});
