import { describe, expect, it } from "vitest";
import { firstParam, formatMoney } from "@/lib/utils";

describe("formatMoney", () => {
  // commercetools money: centAmount in the currency's smallest unit, fractionDigits says how many decimals.
  it("uses fractionDigits instead of assuming two decimals", () => {
    expect(formatMoney({ centAmount: 1050000, currencyCode: "EUR", fractionDigits: 2 })).toBe("€10,500.00");
    expect(formatMoney({ centAmount: 1500, currencyCode: "JPY", fractionDigits: 0 })).toBe("¥1,500");
    expect(formatMoney({ centAmount: 22500000, currencyCode: "GBP", fractionDigits: 2 })).toBe("£225,000.00");
  });
});

describe("firstParam", () => {
  it("takes the first value of a repeated query parameter", () => {
    expect(firstParam(["a", "b"])).toBe("a");
    expect(firstParam("a")).toBe("a");
    expect(firstParam(undefined)).toBeUndefined();
  });
});
