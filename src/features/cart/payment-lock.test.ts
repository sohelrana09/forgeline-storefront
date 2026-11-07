import { describe, expect, it } from "vitest";
import { LOCK_TTL_MS, lockState, parsePaymentLock } from "@/features/cart/payment-lock";

const NOW = Date.parse("2026-11-07T12:00:00Z");
const session = { sessionId: "s", projectKey: "p", region: "us-east-2.aws" };

describe("lockState", () => {
  it("a cart without a lock is open", () => {
    expect(lockState(undefined, NOW)).toBe("open");
  });

  it("a recent lock holds the cart", () => {
    expect(lockState({ lockedAt: NOW - LOCK_TTL_MS }, NOW)).toBe("locked");
  });

  it("a lock older than the TTL is stale", () => {
    expect(lockState({ lockedAt: NOW - LOCK_TTL_MS - 1 }, NOW)).toBe("stale");
    expect(lockState({ lockedAt: NOW - LOCK_TTL_MS - 1, soft: true }, NOW)).toBe("stale");
  });

  it("a lock opened by selecting PayPal is soft", () => {
    expect(lockState({ lockedAt: NOW, soft: true }, NOW)).toBe("soft");
    expect(lockState({ lockedAt: NOW, soft: false }, NOW)).toBe("locked");
  });
});

describe("parsePaymentLock", () => {
  it("reads a stored lock", () => {
    const lock = { session, reviewedCentAmount: 17500, lockedAt: NOW, expiresAt: NOW + 1 };
    expect(parsePaymentLock(lock)).toEqual(lock);
  });

  it("ignores records from before the lock and malformed values", () => {
    expect(parsePaymentLock({ session, cartVersion: 3, expiresAt: NOW })).toBeUndefined();
    expect(parsePaymentLock({ session: {}, reviewedCentAmount: 1, lockedAt: NOW, expiresAt: NOW })).toBeUndefined();
    expect(parsePaymentLock("x")).toBeUndefined();
    expect(parsePaymentLock(null)).toBeUndefined();
  });
});
