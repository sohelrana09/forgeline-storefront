import type { Cart } from "@commercetools/platform-sdk";

// Card payments (G5): when the buyer clicks "Pay by card", the cart they reviewed is frozen (commercetools Frozen cart,
// HardFreeze: prices, discounts and the shipping method stay as they were), and the storefront refuses changes to it
// while the payment form is open. So the amount Checkout charges is the total the buyer reviewed. Pure, unit-tested.
//
// A freeze nobody finished (a closed tab, an abandoned payment) must not lock the cart for good: after FREEZE_TTL_MS
// without any change to the cart, the next change unfreezes it first. Checkout's own writes to the cart (its Payment)
// count as changes, so a payment in progress keeps the lock.

export const FREEZE_TTL_MS = 30 * 60_000;

export const CART_LOCKED_MESSAGE = "A card payment is open for this cart. Finish it at checkout, or cancel it there to change your cart.";

export type FreezeState = "open" | "locked" | "stale";

export function freezeState(cart: Pick<Cart, "cartState" | "lastModifiedAt">, now: number): FreezeState {
  if (cart.cartState !== "Frozen") return "open";
  const changed = Date.parse(cart.lastModifiedAt);
  return Number.isNaN(changed) || now - changed > FREEZE_TTL_MS ? "stale" : "locked";
}

// Thrown by cart writes on a locked cart; its message is safe to show.
export class CartLockedError extends Error {
  constructor() {
    super(CART_LOCKED_MESSAGE);
  }
}
