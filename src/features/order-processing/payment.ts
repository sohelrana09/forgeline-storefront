import type { Order, OrderUpdateAction, Payment, PaymentDraft, PaymentUpdateAction } from "@commercetools/platform-sdk";

// Payments for orders that aren't paid at checkout (G3): business orders on invoice (invoice + PO, order from quote)
// and B2C bank-transfer orders get a Payment resource, so finance can reconcile them like card payments, and the
// order a paymentState (Pending until finance or the ERP marks it Paid). Card orders already have the Payment
// commercetools Checkout created. Pure, unit-tested; service.ts does the writes.

export type PaymentKind = "invoice" | "bank-transfer" | "card";

export const PAYMENT_INTERFACE = "storefront";
const NAMES: Record<Exclude<PaymentKind, "card">, string> = { invoice: "Invoice", "bank-transfer": "Bank transfer" };

export const paymentKey = (orderId: string) => `order-${orderId}`;

// The Payment this order still needs, or undefined. An order that already has a Payment (a card order, or one we
// gave a Payment before) needs none. B2C orders without one are bank-transfer orders: Checkout attaches the card
// Payment to the cart before it creates the order, so a card order never arrives here without it.
// A cancelled order (a rejected approval) is not going to be paid, so it never gets one.
export function pendingPaymentKind(
  order: Pick<Order, "businessUnit" | "paymentInfo"> & Partial<Pick<Order, "orderState">>,
): Exclude<PaymentKind, "card"> | undefined {
  if (order.paymentInfo?.payments.length || order.orderState === "Cancelled") return undefined;
  return order.businessUnit ? "invoice" : "bank-transfer";
}

export function paymentDraft(
  order: Pick<Order, "id" | "taxedPrice" | "totalPrice" | "customerId">,
  kind: Exclude<PaymentKind, "card">,
): PaymentDraft {
  const total = order.taxedPrice?.totalGross ?? order.totalPrice;
  return {
    key: paymentKey(order.id),
    amountPlanned: { currencyCode: total.currencyCode, centAmount: total.centAmount },
    paymentMethodInfo: { paymentInterface: PAYMENT_INTERFACE, method: kind, name: { en: NAMES[kind] } },
    ...(order.customerId ? { customer: { typeId: "customer" as const, id: order.customerId } } : {}),
  };
}

// The order update that links the Payment and sets the payment state, leaving what is already there alone.
export function linkPaymentActions(order: Pick<Order, "paymentInfo" | "paymentState">, paymentId: string): OrderUpdateAction[] {
  const actions: OrderUpdateAction[] = [];
  if (!order.paymentInfo?.payments.some((p) => p.id === paymentId)) {
    actions.push({ action: "addPayment", payment: { typeId: "payment", id: paymentId } });
  }
  if (!order.paymentState) actions.push({ action: "changePaymentState", paymentState: "Pending" });
  return actions;
}

// How an order is paid, for the order page, the confirmation and the PDFs. `methods`: paymentMethodInfo.method of the
// order's Payments (read only when the order has any). Business orders are always on invoice; B2C orders without a
// Payment (placed before G3) were bank-transfer orders.
export function paymentKind(order: Pick<Order, "businessUnit" | "paymentInfo">, methods: (string | undefined)[]): PaymentKind {
  if (order.businessUnit) return "invoice";
  if (!order.paymentInfo?.payments.length || methods.includes("bank-transfer")) return "bank-transfer";
  return "card";
}

// Cancelling an order that was not paid (a rejected approval): the order, and its payment state from Pending to
// Failed in the same update, so finance and the ERP stop expecting the money. commercetools has no "cancelled"
// payment state; Failed is the closest. Any other payment state (Paid, CreditOwed, BalanceDue) is left for finance.
export function cancelOrderActions(order: Pick<Order, "orderState" | "paymentState">): OrderUpdateAction[] {
  const actions: OrderUpdateAction[] = [];
  if (order.orderState !== "Cancelled") actions.push({ action: "changeOrderState", orderState: "Cancelled" });
  if (order.paymentState === "Pending") actions.push({ action: "changePaymentState", paymentState: "Failed" });
  return actions;
}

export const CANCELLED_PAYMENT = { code: "cancelled", text: "Order cancelled before payment" };

// Our own Payment (invoice or bank transfer) of a cancelled order says so on the Payment too, for anyone reading
// Payments rather than orders. Card Payments belong to Checkout and its Connector: never touched here.
export function cancelledPaymentActions(payment: Pick<Payment, "paymentMethodInfo" | "paymentStatus">): PaymentUpdateAction[] {
  if (payment.paymentMethodInfo.paymentInterface !== PAYMENT_INTERFACE) return [];
  if (payment.paymentStatus.interfaceCode === CANCELLED_PAYMENT.code) return [];
  return [
    { action: "setStatusInterfaceCode", interfaceCode: CANCELLED_PAYMENT.code },
    { action: "setStatusInterfaceText", interfaceText: CANCELLED_PAYMENT.text },
  ];
}
