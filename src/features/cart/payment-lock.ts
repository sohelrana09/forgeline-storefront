import type { CheckoutSession } from "@/lib/commercetools/checkout-session";

// Card and PayPal payments (G5): when the payment step opens a Checkout session, the storefront records a payment lock for
// the cart they reviewed (Custom Object `checkout-session/<cart id>`: the Checkout session and the reviewed total) and
// refuses changes to that cart while the lock is fresh. So the amount Checkout charges is the total the buyer reviewed.
// Pure, unit-tested; reads and writes are in features/cart/service.ts.
//
// commercetools' Frozen carts can't do this: Checkout only pays Active carts (it answers `cart_invalid_state`). Unlike a
// freeze, the lock can't stop a price or discount from changing while the buyer pays; finishCardPayment compares the
// order with the reviewed total and the order page says so when they differ.
//
// A lock nobody finished (a closed tab) must not hold the cart for good: after LOCK_TTL_MS the next change removes it,
// unless a payment on the cart is running or took money.
//
// A soft lock is opened by selecting card or PayPal (the card fields and PayPal's button only exist inside a Checkout
// session, so the session opens as soon as either is chosen). The buyer hasn't asked to pay yet, so any cart change
// removes it, again unless a payment is running or took money; the payment step then opens a new session for the new
// total. A full lock comes from the "Pay by card" button, which the payment step shows only when opening on its own
// failed, and stays full when its session is renewed.

export const LOCK_TTL_MS = 30 * 60_000;
// How long a stored Checkout session is shown again (a reload, a second tab) instead of opening another one.
export const SESSION_TTL_MS = 15 * 60_000;

export const CART_LOCKED_MESSAGE = "A payment is open for this cart. Finish it at checkout, or cancel it there to change your cart.";

export type PaymentLock = {
  session: CheckoutSession;
  reviewedCentAmount: number;
  lockedAt: number;
  expiresAt: number;
  // Opened by selecting card or PayPal: cart changes remove it (above).
  soft?: boolean;
};

export type LockState = "open" | "locked" | "soft" | "stale";

export function lockState(lock: Pick<PaymentLock, "lockedAt" | "soft"> | undefined, now: number): LockState {
  if (!lock) return "open";
  if (now - lock.lockedAt > LOCK_TTL_MS) return "stale";
  return lock.soft ? "soft" : "locked";
}

// The stored value, or undefined for anything else (records from before the lock had no `lockedAt`).
export function parsePaymentLock(value: unknown): PaymentLock | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Partial<PaymentLock>;
  const s = v.session;
  const valid =
    typeof s?.sessionId === "string" &&
    typeof s.projectKey === "string" &&
    typeof s.region === "string" &&
    Number.isFinite(v.reviewedCentAmount) &&
    Number.isFinite(v.lockedAt) &&
    Number.isFinite(v.expiresAt);
  return valid ? (v as PaymentLock) : undefined;
}

// Thrown by cart writes on a locked cart; its message is safe to show.
export class CartLockedError extends Error {
  constructor() {
    super(CART_LOCKED_MESSAGE);
  }
}
