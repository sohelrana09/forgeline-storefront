import { describe, expect, it } from "vitest";
import type { Order } from "@commercetools/platform-sdk";
import type { Payment } from "@commercetools/platform-sdk";
import {
  cancelOrderActions,
  cancelledPaymentActions,
  linkPaymentActions,
  paymentDraft,
  paymentKind,
  pendingPaymentKind,
} from "@/features/order-processing/payment";

const ID = "16202ea1-32c0-49fa-8297-79c63deb57ca";
const money = (centAmount: number) => ({ type: "centPrecision" as const, currencyCode: "EUR", centAmount, fractionDigits: 2 });
const unit = { typeId: "business-unit" as const, key: "es-company" };
const paid = { payments: [{ typeId: "payment" as const, id: "p1" }] };

describe("pendingPaymentKind", () => {
  it("invoice for business orders, bank transfer for B2C orders", () => {
    expect(pendingPaymentKind({ businessUnit: unit })).toBe("invoice");
    expect(pendingPaymentKind({})).toBe("bank-transfer");
  });

  it("nothing for orders that already have a Payment", () => {
    expect(pendingPaymentKind({ paymentInfo: paid })).toBeUndefined();
    expect(pendingPaymentKind({ businessUnit: unit, paymentInfo: paid })).toBeUndefined();
  });

  it("nothing for cancelled orders", () => {
    expect(pendingPaymentKind({ businessUnit: unit, orderState: "Cancelled" })).toBeUndefined();
    expect(pendingPaymentKind({ orderState: "Cancelled" })).toBeUndefined();
  });
});

describe("cancelOrderActions", () => {
  it("cancels and marks a pending payment failed, in one update", () => {
    expect(cancelOrderActions({ orderState: "Open", paymentState: "Pending" })).toEqual([
      { action: "changeOrderState", orderState: "Cancelled" },
      { action: "changePaymentState", paymentState: "Failed" },
    ]);
  });

  it("leaves other payment states and orders without one alone", () => {
    expect(cancelOrderActions({ orderState: "Open" })).toEqual([{ action: "changeOrderState", orderState: "Cancelled" }]);
    expect(cancelOrderActions({ orderState: "Open", paymentState: "Paid" })).toEqual([
      { action: "changeOrderState", orderState: "Cancelled" },
    ]);
  });

  it("only fixes the payment state of an order cancelled before, and nothing when done", () => {
    expect(cancelOrderActions({ orderState: "Cancelled", paymentState: "Pending" })).toEqual([
      { action: "changePaymentState", paymentState: "Failed" },
    ]);
    expect(cancelOrderActions({ orderState: "Cancelled", paymentState: "Failed" })).toEqual([]);
  });
});

describe("cancelledPaymentActions", () => {
  const ours = (interfaceCode?: string) =>
    ({ paymentMethodInfo: { paymentInterface: "storefront", method: "invoice" }, paymentStatus: { interfaceCode } }) as Payment;

  it("marks our own Payment cancelled once", () => {
    expect(cancelledPaymentActions(ours())).toEqual([
      { action: "setStatusInterfaceCode", interfaceCode: "cancelled" },
      { action: "setStatusInterfaceText", interfaceText: "Order cancelled before payment" },
    ]);
    expect(cancelledPaymentActions(ours("cancelled"))).toEqual([]);
  });

  it("never touches a Checkout card Payment", () => {
    const card = { paymentMethodInfo: { paymentInterface: "checkout-stripe", method: "card" }, paymentStatus: {} } as Payment;
    expect(cancelledPaymentActions(card)).toEqual([]);
  });
});

describe("paymentDraft", () => {
  it("plans the gross total, keyed by the order", () => {
    const order = { id: ID, totalPrice: money(11764), taxedPrice: { totalGross: money(14000) } } as Order;
    expect(paymentDraft(order, "bank-transfer")).toEqual({
      key: `order-${ID}`,
      amountPlanned: { currencyCode: "EUR", centAmount: 14000 },
      paymentMethodInfo: { paymentInterface: "storefront", method: "bank-transfer", name: { en: "Bank transfer" } },
    });
  });

  it("falls back to the total price and links the customer", () => {
    const order = { id: ID, totalPrice: money(500), customerId: "c1" } as Order;
    const draft = paymentDraft(order, "invoice");
    expect(draft.amountPlanned.centAmount).toBe(500);
    expect(draft.customer).toEqual({ typeId: "customer", id: "c1" });
    expect(draft.paymentMethodInfo?.method).toBe("invoice");
  });
});

describe("linkPaymentActions", () => {
  it("adds the Payment and sets Pending", () => {
    expect(linkPaymentActions({}, "p1")).toEqual([
      { action: "addPayment", payment: { typeId: "payment", id: "p1" } },
      { action: "changePaymentState", paymentState: "Pending" },
    ]);
  });

  it("keeps what is already there", () => {
    expect(linkPaymentActions({ paymentInfo: paid, paymentState: "Paid" }, "p1")).toEqual([]);
  });
});

describe("paymentKind", () => {
  it("business orders are on invoice", () => {
    expect(paymentKind({ businessUnit: unit }, [])).toBe("invoice");
    expect(paymentKind({ businessUnit: unit, paymentInfo: paid }, ["invoice"])).toBe("invoice");
  });

  it("B2C: our bank-transfer Payment, an older order without one, or a card Payment", () => {
    expect(paymentKind({ paymentInfo: paid }, ["bank-transfer"])).toBe("bank-transfer");
    expect(paymentKind({}, [])).toBe("bank-transfer");
    expect(paymentKind({ paymentInfo: paid }, ["card"])).toBe("card");
    expect(paymentKind({ paymentInfo: paid }, [undefined])).toBe("card");
  });

  it("B2C: a PayPal Payment, by its method or its interface", () => {
    expect(paymentKind({ paymentInfo: paid }, ["paypal"])).toBe("paypal");
    expect(paymentKind({ paymentInfo: paid }, [undefined, "PayPal"])).toBe("paypal");
    expect(paymentKind({ businessUnit: unit, paymentInfo: paid }, ["paypal"])).toBe("invoice");
  });
});
