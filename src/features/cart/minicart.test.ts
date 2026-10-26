import type { Cart } from "@commercetools/platform-sdk";
import { describe, expect, it } from "vitest";
import { toMiniCart } from "@/features/cart/minicart";

const money = (centAmount: number) => ({ type: "centPrecision" as const, centAmount, currencyCode: "EUR", fractionDigits: 2 });

// Only the fields toMiniCart reads; commercetools carts carry many more.
function cart(lines: { sku: string; qty: number; unit: number; discounted?: number }[], shipping = 0): Cart {
  const lineItems = lines.map((l, i) => ({
    id: `line-${i}`,
    name: { "en-US": `Product ${l.sku}` },
    productSlug: { "en-US": `product-${l.sku}` },
    variant: { sku: l.sku, images: [{ url: `https://img.example/${l.sku}.jpg` }] },
    quantity: l.qty,
    price: { value: money(l.unit), ...(l.discounted && { discounted: { value: money(l.discounted) } }) },
    totalPrice: money((l.discounted ?? l.unit) * l.qty),
  }));
  const linesTotal = lineItems.reduce((n, l) => n + l.totalPrice.centAmount, 0);
  return { lineItems, totalPrice: money(linesTotal + shipping) } as unknown as Cart;
}

describe("toMiniCart", () => {
  it("is empty without a cart or lines", () => {
    expect(toMiniCart(undefined, true)).toMatchObject({ items: 0, lines: [], canOrder: true });
    expect(toMiniCart(cart([]), false)).toMatchObject({ items: 0, lines: [], canOrder: false });
  });

  it("counts items, formats prices and builds product links", () => {
    const summary = toMiniCart(
      cart([
        { sku: "air-filter", qty: 2, unit: 3500 },
        { sku: "oil-filter", qty: 3, unit: 2500, discounted: 2250 },
      ]),
      true,
    );
    expect(summary.items).toBe(5);
    expect(summary.lines[0]).toMatchObject({
      name: "Product air-filter",
      href: "/p/product-air-filter?sku=air-filter",
      image: "https://img.example/air-filter.jpg",
      price: "€35.00",
      quoteOnly: false,
    });
    expect(summary.lines[1].price).toBe("€22.50"); // the discounted unit price
  });

  it("shows the lines' subtotal, without shipping", () => {
    const summary = toMiniCart(cart([{ sku: "air-filter", qty: 2, unit: 3500 }], 1500), true);
    expect(summary.subtotal).toBe("€70.00");
    expect(summary.total).toBe("€85.00");
  });

  it("flags machines priced on quote", () => {
    const summary = toMiniCart(cart([{ sku: "jj234-wx-2015", qty: 1, unit: 2_475_000 }]), true);
    expect(summary.hasQuoteLines).toBe(true);
    expect(summary.lines[0].quoteOnly).toBe(true);
  });
});
