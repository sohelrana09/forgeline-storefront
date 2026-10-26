import type { Cart } from "@commercetools/platform-sdk";
import { isQuoteOnly, localize } from "@/features/catalog/utils";
import { formatMoney } from "@/lib/utils";

// What the header's minicart shows (Magento "minicart"): plain, serializable data built from the cart on the server,
// either in SiteChrome (per-visitor pages) or in /api/cart-summary (cached guest pages).
export type MiniCartLine = {
  id: string;
  name: string;
  sku: string;
  href: string;
  image?: string;
  quantity: number;
  // Unit price after product discounts, formatted.
  price: string;
  quoteOnly: boolean;
};

export type MiniCartSummary = {
  items: number;
  // Header total: what the cart page shows as the total (gross where tax is known).
  total?: string;
  // Panel subtotal: the lines only, before shipping (Magento "Cart Subtotal").
  subtotal?: string;
  lines: MiniCartLine[];
  // Machines priced on quote are in the cart: it goes to "Request a quote", not checkout.
  hasQuoteLines: boolean;
  // The visitor may change this cart (buyers, consumers, guests; not associates without the buyer role).
  canOrder: boolean;
};

// Fired after anything changes the cart in the browser (AddToCartForm, the minicart itself): the minicart reloads.
export const CART_CHANGED = "cart:changed";

export const EMPTY_MINICART: MiniCartSummary = { items: 0, lines: [], hasQuoteLines: false, canOrder: false };

export function toMiniCart(cart: Cart | undefined, canOrder: boolean): MiniCartSummary {
  if (!cart || cart.lineItems.length === 0) return { ...EMPTY_MINICART, canOrder };
  const { currencyCode, fractionDigits } = cart.totalPrice;
  const lines = cart.lineItems.map((l): MiniCartLine => {
    const sku = l.variant.sku ?? "";
    return {
      id: l.id,
      name: localize(l.name),
      sku,
      href: `/p/${localize(l.productSlug)}?sku=${encodeURIComponent(sku)}`,
      image: l.variant.images?.[0]?.url,
      quantity: l.quantity,
      price: formatMoney(l.price.discounted?.value ?? l.price.value),
      quoteOnly: isQuoteOnly(l.price),
    };
  });
  return {
    items: cart.lineItems.reduce((n, l) => n + l.quantity, 0),
    total: formatMoney(cart.taxedPrice?.totalGross ?? cart.totalPrice),
    subtotal: formatMoney({
      centAmount: cart.lineItems.reduce((n, l) => n + l.totalPrice.centAmount, 0),
      currencyCode,
      fractionDigits,
    }),
    lines,
    hasQuoteLines: lines.some((l) => l.quoteOnly),
    canOrder,
  };
}
