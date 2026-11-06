// What the API Extension answers for a cart (pure): the company price of every line, as `setLineItemPrice` with an
// `externalPrice`. commercetools calls the extension on every cart create and update, so a quantity change re-prices
// the line at its new tier. Lines without a company price go back to the platform price (the web price row).
import type { Cart, CartUpdateAction } from "@commercetools/platform-sdk";
import { priceFor, sameMoney, toMoneyDraft } from "@/features/company-pricing/ladder";
import type { Ladder } from "@/features/company-pricing/types";

export function priceActions(cart: Cart, ladders: Map<string, Ladder>): CartUpdateAction[] {
  const actions: CartUpdateAction[] = [];
  for (const line of cart.lineItems) {
    const ladder = line.variant.sku ? ladders.get(line.variant.sku) : undefined;
    if (!ladder) {
      if (line.priceMode === "ExternalPrice") actions.push({ action: "setLineItemPrice", lineItemId: line.id });
      continue;
    }
    const price = toMoneyDraft(priceFor(ladder, line.quantity), cart.totalPrice.currencyCode);
    if (line.priceMode === "ExternalPrice" && sameMoney(line.price.value, price)) continue;
    actions.push({ action: "setLineItemPrice", lineItemId: line.id, externalPrice: price });
  }
  return actions;
}

// A cart that had company prices and now finds none at all: the store was wiped or half synced, and answering would
// reset every line to the web price. A cart that never had one (a SKU the company has no price for) is fine.
export const lostCompanyPrices = (cart: Cart, ladders: Map<string, Ladder>) =>
  ladders.size === 0 && cart.lineItems.some((line) => line.priceMode === "ExternalPrice");

// The SKUs whose prices the extension needs.
export const cartSkus = (cart: Cart) => [...new Set(cart.lineItems.flatMap((l) => (l.variant.sku ? [l.variant.sku] : [])))];
