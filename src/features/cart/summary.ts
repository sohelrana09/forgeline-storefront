import type { Cart, Order, Quote, QuoteRequest } from "@commercetools/platform-sdk";

// The totals of a cart, order, quote request or quote (same shape on all four), as the summary box and the order
// documents show them. Shipping is on the same basis as the lines (EU: gross, US: net plus tax rows), so the rows add
// up to the total. Amounts in cents of `currency`.
export type Summary = {
  currency: string;
  fractionDigits: number;
  items: number;
  subtotal: number;
  shipping?: { name?: string; amount?: number };
  taxIncluded: boolean;
  taxes?: { label: string; amount: number }[];
  total: number;
};

export function summarize(cart: Cart | Order | Quote | QuoteRequest): Summary {
  const taxIncluded = cart.lineItems.some((l) => l.taxRate?.includedInPrice);
  const shippingTaxed = cart.shippingInfo?.taxedPrice;
  const taxed = cart.taxedPrice;
  return {
    currency: cart.totalPrice.currencyCode,
    fractionDigits: cart.totalPrice.fractionDigits,
    items: cart.lineItems.reduce((n, l) => n + l.quantity, 0),
    subtotal: cart.lineItems.reduce((sum, l) => sum + l.totalPrice.centAmount, 0),
    shipping: cart.shippingInfo && {
      name: cart.shippingInfo.shippingMethodName,
      amount: (taxIncluded ? shippingTaxed?.totalGross : shippingTaxed?.totalNet)?.centAmount ?? cart.shippingInfo.price.centAmount,
    },
    taxIncluded,
    taxes: taxed?.taxPortions.map((t) => ({
      label: `${taxIncluded ? "incl. " : ""}${t.name ?? "Tax"} ${Math.round(t.rate * 1000) / 10}%`,
      amount: t.amount.centAmount,
    })),
    total: (taxed?.totalGross ?? cart.totalPrice).centAmount,
  };
}
