import { describe, expect, it } from "vitest";
import { firstParam, formatMoney } from "@/lib/utils";

describe("formatMoney", () => {
  // commercetools money: centAmount in the currency's smallest unit, fractionDigits says how many decimals.
  it("uses fractionDigits instead of assuming two decimals", () => {
    expect(formatMoney({ centAmount: 1050000, currencyCode: "EUR", fractionDigits: 2 })).toBe("€10,500.00");
    expect(formatMoney({ centAmount: 1500, currencyCode: "JPY", fractionDigits: 0 })).toBe("¥1,500");
    expect(formatMoney({ centAmount: 22500000, currencyCode: "GBP", fractionDigits: 2 })).toBe("£225,000.00");
  });
  it("shows high-precision money from its precise amount, up to 4 decimals", () => {
    expect(formatMoney({ centAmount: 39, preciseAmount: 386559, currencyCode: "NZD", fractionDigits: 6 })).toBe("NZ$0.3866");
    expect(formatMoney({ centAmount: 14954, preciseAmount: 1495395, currencyCode: "NZD", fractionDigits: 4 })).toBe("NZ$149.5395");
    expect(formatMoney({ centAmount: 1291, preciseAmount: 129100, currencyCode: "NZD", fractionDigits: 4 })).toBe("NZ$12.91");
  });
});

describe("firstParam", () => {
  it("takes the first value of a repeated query parameter", () => {
    expect(firstParam(["a", "b"])).toBe("a");
    expect(firstParam("a")).toBe("a");
    expect(firstParam(undefined)).toBeUndefined();
  });
});
