import { describe, expect, it } from "vitest";
import type { Order, Payment } from "@commercetools/platform-sdk";
import { hasLiveTransaction, hasMoney, PAYMENT_INTERFACE, reconcile } from "@/features/order-processing/payment";

const order = (centAmount: number) => ({ totalPrice: { centAmount } }) as unknown as Order;
const tx = (type: string, state: string, centAmount: number) => ({ type, state, amount: { centAmount } });
const payment = (transactions: unknown[], paymentInterface = "adyen") =>
  ({ transactions, paymentMethodInfo: { paymentInterface } }) as unknown as Payment;

describe("reconcile", () => {
  it("is Pending until money was charged", () => {
    expect(reconcile(order(100), [payment([tx("Authorization", "Success", 100)])])).toMatchObject({
      paymentState: "Pending",
      mismatch: false,
    });
  });

  it("is Paid when the charge fits", () => {
    expect(reconcile(order(100), [payment([tx("Charge", "Success", 100)])])).toMatchObject({ paymentState: "Paid", mismatch: false });
  });

  it("flags a short charge", () => {
    expect(reconcile(order(100), [payment([tx("Charge", "Success", 60)])])).toMatchObject({ paymentState: "BalanceDue", mismatch: true });
  });

  it("flags too much money", () => {
    expect(reconcile(order(100), [payment([tx("Charge", "Success", 160)])])).toMatchObject({ paymentState: "CreditOwed", mismatch: true });
  });

  it("flags an authorisation for another amount", () => {
    expect(reconcile(order(100), [payment([tx("Authorization", "Success", 90)])]).mismatch).toBe(true);
  });

  it("subtracts refunds and chargebacks", () => {
    const refunded = payment([tx("Charge", "Success", 100), tx("Refund", "Success", 100)]);
    expect(reconcile(order(100), [refunded])).toMatchObject({ settled: 0, paymentState: "BalanceDue" });
  });

  it("ignores failed transactions and our own Payments", () => {
    const failed = payment([tx("Charge", "Failure", 100)]);
    const ours = payment([tx("Charge", "Success", 100)], PAYMENT_INTERFACE);
    expect(reconcile(order(100), [failed, ours]).paymentState).toBe("Pending");
  });

  it("prefers the taxed gross over the net total", () => {
    const taxed = { totalPrice: { centAmount: 100 }, taxedPrice: { totalGross: { centAmount: 119 } } } as unknown as Order;
    expect(reconcile(taxed, [payment([tx("Charge", "Success", 119)])]).paymentState).toBe("Paid");
  });
});

describe("payment state of a cart", () => {
  it("treats pending and successful money as live, but not a form that only opened", () => {
    expect(hasLiveTransaction(payment([tx("Authorization", "Pending", 1)]))).toBe(true);
    expect(hasLiveTransaction(payment([tx("Charge", "Success", 1)]))).toBe(true);
    expect(hasLiveTransaction(payment([tx("Charge", "Initial", 1)]))).toBe(false);
    expect(hasLiveTransaction(payment([tx("Charge", "Failure", 1)]))).toBe(false);
  });

  it("knows when money was taken", () => {
    expect(hasMoney(payment([tx("Authorization", "Success", 1)]))).toBe(true);
    expect(hasMoney(payment([tx("Refund", "Success", 1)]))).toBe(false);
  });
});
