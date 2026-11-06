import { describe, expect, it } from "vitest";
import { normalizePrice, parseLadder, priceFor, sameMoney, toMoneyDraft, toPrice, toTypedMoney } from "@/features/company-pricing/ladder";

describe("normalizePrice", () => {
  it("trims zeros and accepts a leading dot", () => {
    expect(normalizePrice("0012.500")).toBe("12.5");
    expect(normalizePrice(".386559")).toBe("0.386559");
    expect(normalizePrice("100")).toBe("100");
    expect(normalizePrice("100.")).toBe("100");
  });
  it("refuses empty and malformed prices", () => {
    expect(normalizePrice("")).toBeUndefined();
    expect(normalizePrice(".")).toBeUndefined();
    expect(normalizePrice("-1")).toBeUndefined();
    expect(normalizePrice("1,5")).toBeUndefined();
    expect(normalizePrice(null)).toBeUndefined();
  });
});

describe("parseLadder", () => {
  it("reads the shop's KeyDB hash: JSON strings, '' for quantity 1, sorted", () => {
    expect(parseLadder({ "15": '{"p":"11.62026","ud":1}', "": '{"p":"12.9114","ud":1}' })).toEqual([
      { minQuantity: 1, price: "12.9114" },
      { minQuantity: 15, price: "11.62026" },
    ]);
  });
  it("accepts values Upstash already parsed", () => {
    expect(parseLadder({ "": { p: "5", ud: 1 } })).toEqual([{ minQuantity: 1, price: "5" }]);
  });
  it("has no ladder without a usable base price", () => {
    expect(parseLadder({ "": '{"p":"","ud":1}', "10": '{"p":"4","ud":1}' })).toBeUndefined();
    expect(parseLadder(null)).toBeUndefined();
    expect(parseLadder({ "": "not json" })).toBeUndefined();
  });
});

describe("priceFor", () => {
  const ladder = [
    { minQuantity: 1, price: "10" },
    { minQuantity: 6, price: "9.5" },
    { minQuantity: 12, price: "9" },
  ];
  it("picks the highest break the quantity reaches", () => {
    expect(priceFor(ladder, 1)).toBe("10");
    expect(priceFor(ladder, 5)).toBe("10");
    expect(priceFor(ladder, 6)).toBe("9.5");
    expect(priceFor(ladder, 100)).toBe("9");
  });
});

describe("money", () => {
  it("uses cent precision up to the currency's decimals", () => {
    expect(toMoneyDraft("12.5", "NZD")).toEqual({ type: "centPrecision", currencyCode: "NZD", centAmount: 1250 });
    expect(toTypedMoney("149.5395", "NZD")).toEqual({
      type: "highPrecision",
      currencyCode: "NZD",
      preciseAmount: 1495395,
      fractionDigits: 4,
      centAmount: 14954,
    });
  });
  it("keeps SAP's unit prices exact with high precision", () => {
    expect(toMoneyDraft("0.386559", "NZD")).toEqual({
      type: "highPrecision",
      currencyCode: "NZD",
      preciseAmount: 386559,
      fractionDigits: 6,
    });
    expect(toTypedMoney("0.386559", "NZD").centAmount).toBe(39);
  });
  it("compares a line's price with a draft", () => {
    expect(sameMoney(toTypedMoney("0.386559", "NZD"), toMoneyDraft("0.386559", "NZD"))).toBe(true);
    expect(sameMoney(toTypedMoney("12.5", "NZD"), toMoneyDraft("12.5", "NZD"))).toBe(true);
    expect(sameMoney(toTypedMoney("12.5", "NZD"), toMoneyDraft("12.51", "NZD"))).toBe(false);
    expect(sameMoney(toTypedMoney("12.5", "NZD"), toMoneyDraft("12.5", "AUD"))).toBe(false);
  });
  it("builds a Price with tiers", () => {
    const price = toPrice(
      [
        { minQuantity: 1, price: "10" },
        { minQuantity: 15, price: "9" },
      ],
      "NZD",
    );
    expect(price.value.centAmount).toBe(1000);
    expect(price.tiers).toEqual([{ minimumQuantity: 15, value: toTypedMoney("9", "NZD") }]);
  });
});
