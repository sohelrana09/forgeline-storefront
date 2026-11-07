import type { CheckoutSession } from "@/lib/commercetools/checkout-session";

// Card and PayPal payments (G5): when the buyer clicks "Pay by card" or "Continue with PayPal", the storefront records a payment lock for
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

export const LOCK_TTL_MS = 30 * 60_000;
// How long a stored Checkout session is shown again (a reload, a second tab) instead of opening another one.
export const SESSION_TTL_MS = 15 * 60_000;

export const CART_LOCKED_MESSAGE = "A payment is open for this cart. Finish it at checkout, or cancel it there to change your cart.";

export type PaymentLock = { session: CheckoutSession; reviewedCentAmount: number; lockedAt: number; expiresAt: number };

export type LockState = "open" | "locked" | "stale";

export function lockState(lock: Pick<PaymentLock, "lockedAt"> | undefined, now: number): LockState {
  if (!lock) return "open";
  return now - lock.lockedAt <= LOCK_TTL_MS ? "locked" : "stale";
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
