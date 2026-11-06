import { describe, expect, it } from "vitest";
import type { Cart, LineItem } from "@commercetools/platform-sdk";
import { cartSkus, lostCompanyPrices, priceActions } from "@/features/company-pricing/extension";
import { toTypedMoney } from "@/features/company-pricing/ladder";
import { diffLadders } from "@/features/company-pricing/sync";

const line = (id: string, sku: string, quantity: number, extra: Partial<LineItem> = {}) =>
  ({ id, quantity, variant: { sku }, priceMode: "Platform", price: { value: toTypedMoney("20", "NZD") }, ...extra }) as unknown as LineItem;
const cart = (lineItems: LineItem[]) => ({ lineItems, totalPrice: { currencyCode: "NZD" } }) as unknown as Cart;

const ladders = new Map([
  [
    "ACTAS90",
    [
      { minQuantity: 1, price: "12.9114" },
      { minQuantity: 15, price: "11.62026" },
    ],
  ],
]);

describe("priceActions", () => {
  it("sets the company price for the line's quantity", () => {
    expect(priceActions(cart([line("a", "ACTAS90", 1)]), ladders)).toEqual([
      {
        action: "setLineItemPrice",
        lineItemId: "a",
        externalPrice: { type: "highPrecision", currencyCode: "NZD", preciseAmount: 129114, fractionDigits: 4 },
      },
    ]);
    expect(priceActions(cart([line("a", "ACTAS90", 15)]), ladders)[0]).toMatchObject({
      externalPrice: { preciseAmount: 1162026, fractionDigits: 5 },
    });
  });
  it("sends nothing when the line already has that price", () => {
    const priced = line("a", "ACTAS90", 2, {
      priceMode: "ExternalPrice",
      price: { value: toTypedMoney("12.9114", "NZD") },
    } as Partial<LineItem>);
    expect(priceActions(cart([priced]), ladders)).toEqual([]);
  });
  it("returns lines without a company price to the platform price", () => {
    const external = line("b", "OTHER", 1, { priceMode: "ExternalPrice" });
    expect(priceActions(cart([external, line("c", "OTHER", 1)]), ladders)).toEqual([{ action: "setLineItemPrice", lineItemId: "b" }]);
  });
  it("lists the cart's SKUs once", () => {
    expect(cartSkus(cart([line("a", "X", 1), line("b", "X", 2), line("c", "Y", 1)]))).toEqual(["X", "Y"]);
  });
});

describe("diffLadders", () => {
  const v = (p: string, ud = 1) => JSON.stringify({ p, ud });
  it("ignores re-stamped timestamps and finds real changes", () => {
    const current = new Map([
      ["C|A", { "": v("10", 1) }],
      ["C|B", { "": v("5", 1) }],
      ["C|OLD", { "": v("1", 1) }],
    ]);
    const diff = diffLadders({ "C|A": { "": v("10", 2) }, "C|B": { "": v("5.5", 2) }, "C|NEW": { "": v("3", 2) } }, current);
    expect(diff).toMatchObject({ added: 1, changed: 1, unchanged: 1, remove: ["C|OLD"] });
    expect(Object.keys(diff.set)).toEqual(["C|B", "C|NEW"]);
  });
});

describe("lostCompanyPrices", () => {
  const cart = (priceMode: string) => ({ lineItems: [{ priceMode }] }) as unknown as Cart;
  it("refuses when a cart with company prices finds none", () => expect(lostCompanyPrices(cart("ExternalPrice"), new Map())).toBe(true));
  it("accepts a cart that never had any", () => expect(lostCompanyPrices(cart("Platform"), new Map())).toBe(false));
});
