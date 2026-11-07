import type { ReactNode } from "react";
import { CheckoutStep } from "@/features/checkout/components/CheckoutStep";
import { Message } from "@/components/ui/Message";
import { PaymentMethods, type PaymentKind, type PaymentOption } from "@/features/checkout/components/PaymentMethods";

export type { PaymentKind };

const invoice = {
  title: "Purchase order (pay on invoice)",
  description: "Invoiced to your company under your payment terms.",
};
const bankTransfer = {
  title: "Bank transfer",
  description: "Your order confirmation shows our bank details and the reference to use. We ship once the payment arrives.",
};
const card = {
  title: "Credit or debit card",
  description: "Handled by commercetools Checkout. We never see your card number.",
};
const paypal = {
  title: "PayPal",
  description: "Pay with your PayPal account. We never see your PayPal login.",
};

// Step 3 of the one-step checkout (Payment Method): one list of payment methods for this kind of
// customer, the billing address they share (`billing`), then the chosen method's button.
export function PaymentStep({
  kinds,
  billing,
  cartVersion,
  purchaseOrderNumber,
  ready,
  waitingFor,
  paymentOpen = false,
}: {
  kinds: PaymentKind[];
  billing: ReactNode;
  cartVersion: number;
  purchaseOrderNumber?: string;
  ready: boolean;
  waitingFor?: string;
  // The cart is locked: a card or PayPal payment was opened for it (features/cart/payment-lock.ts).
  paymentOpen?: boolean;
}) {
  const details = { invoice, "bank-transfer": bankTransfer, card, paypal };
  // An open payment is finished or cancelled first: only the methods paid through Checkout until then.
  const open = paymentOpen ? kinds.filter((k) => k === "card" || k === "paypal") : [];
  const offered = open.length > 0 ? open : kinds;
  const options: PaymentOption[] = offered.map((kind) => ({ kind, ...details[kind] }));
  // No method switched on (B2C_CARD_PAYMENTS, CHECKOUT_PAYPAL, B2C_BANK_TRANSFER all off).
  if (options.length === 0) {
    return (
      <CheckoutStep step={3} title="Payment method" waitingFor={waitingFor}>
        <Message type="error">Online ordering is not available right now. Please contact us to place your order.</Message>
      </CheckoutStep>
    );
  }
  return (
    <CheckoutStep step={3} title="Payment method" waitingFor={waitingFor}>
      <div className="flex flex-col gap-4">
        <PaymentMethods
          options={options}
          cartVersion={cartVersion}
          purchaseOrderNumber={purchaseOrderNumber}
          ready={ready}
          paymentOpen={paymentOpen}
        >
          {billing}
        </PaymentMethods>
      </div>
    </CheckoutStep>
  );
}
