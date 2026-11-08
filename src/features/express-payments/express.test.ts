import { describe, expect, it } from "vitest";
import { expressEnabled, fullAddress, partialAddress, walletEmail, walletShippingMethods } from "@/features/express-payments/express";

describe("wallet addresses", () => {
  it("takes the partial address for rates, in a country we ship to", () => {
    expect(partialAddress({ country: "de", postalCode: " 10115 ", city: "Berlin", state: "" })).toEqual({
      country: "DE",
      postalCode: "10115",
      city: "Berlin",
      state: undefined,
    });
    expect(partialAddress({ country: "US", postalCode: "1" })).toBeUndefined();
    expect(partialAddress({ country: 5 })).toBeUndefined();
  });
  it("needs name, street, postcode and city in the full address, cleaned and cut", () => {
    const full = fullAddress({
      country: "ES",
      firstName: "Ana",
      lastName: "Ruiz",
      streetName: "Calle\u0000 Mayor",
      postalCode: "28013",
      city: "Madrid",
    });
    expect(full).toMatchObject({ country: "ES", lastName: "Ruiz", streetName: "Calle  Mayor", city: "Madrid" });
    expect(fullAddress({ country: "ES", lastName: "Ruiz", postalCode: "28013", city: "Madrid" })).toBeUndefined();
    expect(fullAddress({ country: "ES", lastName: "x".repeat(100), streetName: "s", postalCode: "1", city: "c" })?.lastName).toHaveLength(
      60,
    );
  });
  it("accepts a plain email only", () => {
    expect(walletEmail(" ana@example.com ")).toBe("ana@example.com");
    expect(walletEmail("not an email")).toBeUndefined();
  });
});

describe("walletShippingMethods", () => {
  const eur = (centAmount: number) => ({ centAmount, currencyCode: "EUR", fractionDigits: 2 });
  it("lists priced methods, free above the threshold, with the selection", () => {
    const options = [
      { key: "standard", name: "Standard", price: eur(10000), freeAbove: eur(1000000) },
      { key: "premium", name: "Premium", price: eur(30000) },
      { key: "none", name: "No rate" },
    ];
    expect(walletShippingMethods(options, 1000000, "premium")).toEqual([
      { id: "standard", name: "Standard", isSelected: false, amount: { type: "centPrecision", ...eur(0) } },
      { id: "premium", name: "Premium", isSelected: true, amount: { type: "centPrecision", ...eur(30000) } },
    ]);
  });
  it("is off by default", () => expect(expressEnabled({})).toBe(false));
});
