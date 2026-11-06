import { describe, expect, it } from "vitest";
import type { Cart, TypedMoney } from "@commercetools/platform-sdk";
import { addressLabel, methodOptions, sameAddress, selectedMethodKey } from "@/features/checkout/utils";
import type { ShippingOption } from "@/features/cart/service";

const eur = (centAmount: number): TypedMoney => ({ type: "centPrecision", currencyCode: "EUR", centAmount, fractionDigits: 2 });
const cart = (subtotal: number) => ({ lineItems: [{ totalPrice: eur(subtotal) }] }) as Cart;
const option = (o: Partial<ShippingOption>) => ({ key: "std", name: "Standard", ...o }) as ShippingOption;

describe("addressLabel", () => {
  it("joins the parts that are set, one per line", () =>
    expect(
      addressLabel({
        country: "ES",
        firstName: "Sofía",
        company: "LiftTech",
        streetName: "Calle Mayor",
        streetNumber: "5",
        city: "Madrid",
      }),
    ).toBe("Sofía\nLiftTech\nCalle Mayor 5\nMadrid\nES"));
});

describe("methodOptions", () => {
  it("is free above the threshold and says so below it", () => {
    const o = option({ price: eur(1500), freeAbove: eur(10000) });
    expect(methodOptions([o], cart(12000))[0]).toMatchObject({ price: "Free", note: undefined });
    const below = methodOptions([o], cart(5000))[0];
    expect(below.price).not.toBe("Free");
    expect(below.note).toMatch(/^Free above /);
  });

  it("shows a zero price as Free and a missing one as On request", () => {
    expect(methodOptions([option({ price: eur(0) })], cart(1))[0].price).toBe("Free");
    expect(methodOptions([option({})], cart(1))[0].price).toBe("On request");
  });
});

describe("sameAddress", () => {
  const office = {
    id: "a1",
    key: "hq",
    country: "ES",
    city: "Madrid",
    streetName: "Gran Via",
    streetNumber: "1",
    postalCode: "28013",
    company: "Acme",
  };

  it("matches the cart's copy (no id or key), ignoring case and spaces", () => {
    expect(
      sameAddress(office, {
        country: "ES",
        city: "madrid ",
        streetName: "Gran Via",
        streetNumber: "1",
        postalCode: "28013",
        company: "ACME",
      }),
    ).toBe(true);
  });

  it("tells apart two addresses on the same street", () => {
    expect(sameAddress(office, { ...office, id: undefined, key: undefined, streetNumber: "7" })).toBe(false);
    expect(sameAddress(office, { ...office, id: undefined, key: undefined, company: "Other" })).toBe(false);
  });

  it("never matches a missing address", () => {
    expect(sameAddress(office, undefined)).toBe(false);
    expect(sameAddress(undefined, undefined)).toBe(false);
  });
});

describe("selectedMethodKey", () => {
  const options = [
    { id: "m1", key: "standard" },
    { id: "m2", key: "premium" },
  ];

  it("finds the cart's method by id", () => {
    const withMethod = { shippingInfo: { shippingMethod: { typeId: "shipping-method", id: "m2" } } } as Pick<Cart, "shippingInfo">;
    expect(selectedMethodKey(options, withMethod)).toBe("premium");
  });

  it("is undefined without a method or for one not offered", () => {
    expect(selectedMethodKey(options, {})).toBeUndefined();
    const other = { shippingInfo: { shippingMethod: { typeId: "shipping-method", id: "zz" } } } as Pick<Cart, "shippingInfo">;
    expect(selectedMethodKey(options, other)).toBeUndefined();
  });
});
