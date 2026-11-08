import type { LineItem, Price, ProductProjection, ProductVariant } from "@commercetools/platform-sdk";
import { localize } from "@/features/catalog/utils";
import type { ItemInput, Money, OrderInput } from "@/features/analytics/events";

// commercetools objects → analytics items (server side; the events themselves are pure in events.ts).

// The price the visitor sees: the discounted value when a product discount applies.
const shownPrice = (price: Price | undefined): Money | undefined => price?.discounted?.value ?? price?.value;

export const variantItem = (name: string, variant: ProductVariant, category?: string): ItemInput => ({
  sku: variant.sku ?? "",
  name,
  price: shownPrice(variant.price),
  category,
});

export const productItems = (products: ProductProjection[], category?: string): ItemInput[] =>
  products.filter((p) => p.masterVariant.sku).map((p) => variantItem(localize(p.name), p.masterVariant, category));

// A cart or order line: the unit price after every discount (line total / quantity), as charged.
export const lineItems = (lines: LineItem[]): ItemInput[] =>
  lines.map((l) => ({
    sku: l.variant.sku ?? l.productId,
    name: localize(l.name),
    quantity: l.quantity,
    price: { ...l.totalPrice, centAmount: l.totalPrice.centAmount / Math.max(1, l.quantity) },
  }));

type OrderLike = {
  id: string;
  orderNumber?: string;
  totalPrice: Money;
  taxedPrice?: { totalGross: Money; totalTax?: Money };
  shippingInfo?: { price: Money };
  lineItems: LineItem[];
};

// purchase: gross total as charged, its tax, shipping, and the lines.
export const orderInput = (order: OrderLike): OrderInput => ({
  id: order.id,
  orderNumber: order.orderNumber,
  total: order.taxedPrice?.totalGross ?? order.totalPrice,
  tax: order.taxedPrice?.totalTax,
  shipping: order.shippingInfo?.price,
  items: lineItems(order.lineItems),
});
