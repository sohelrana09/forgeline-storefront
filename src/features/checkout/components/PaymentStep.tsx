import type { ReactNode } from "react";
import { headers } from "next/headers";
import { preconnect, preloadModule } from "react-dom";
import { nonceOf } from "@/lib/csp";
import { checkoutRegion } from "@/lib/commercetools/checkout-session";
import { CheckoutStep } from "@/features/checkout/components/CheckoutStep";
import { Message } from "@/components/ui/Message";
import { PaymentMethods, type PaymentKind, type PaymentOption } from "@/features/checkout/components/PaymentMethods";
import type { ProcurementForm } from "@/features/checkout/components/CheckoutForm";

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
export async function PaymentStep({
  kinds,
  billing,
  cartVersion,
  purchaseOrderNumber,
  procurement,
  ready,
  waitingFor,
  paymentOpen = false,
}: {
  kinds: PaymentKind[];
  billing: ReactNode;
  cartVersion: number;
  purchaseOrderNumber?: string;
  procurement?: ProcurementForm;
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
  if (offered.some((k) => k === "card" || k === "paypal")) await preconnectCheckout();
  // No method switched on (B2C_CARD_PAYMENTS, CHECKOUT_PAYPAL, B2C_BANK_TRANSFER all off).
  if (options.length === 0) {
    return (
      <CheckoutStep step={3} title="Payment method" waitingFor={waitingFor}>
        <Message type="error">Online ordering is not available right now. Please contact us to place your order.</Message>
      </CheckoutStep>
    );
  }
  return (
    <CheckoutStep step={3} title="Payment method" waitingFor={waitingFor} showWhileWaiting>
      <div className="flex flex-col gap-4">
        <PaymentMethods
          options={options}
          cartVersion={cartVersion}
          purchaseOrderNumber={purchaseOrderNumber}
          procurement={procurement}
          ready={ready}
          paymentOpen={paymentOpen}
        >
          {billing}
        </PaymentMethods>
      </div>
    </CheckoutStep>
  );
}

// Card and PayPal forms are built in the browser by commercetools Checkout, through a chain of requests to hosts the
// page hasn't talked to yet (Checkout's API, each connector's script and service, the payment provider). Open those
// connections while the page loads, so each step of the chain doesn't also wait for DNS and TLS. Checkout's scripts
// load without CORS, its API with it (two connection pools).
// CHECKOUT_PRELOAD (optional, comma-separated URLs; docs/checkout-setup.md) names the connector's hosts, which Connect
// gives each deployment: a URL ending in .js (the connector's enabler script) is also fetched ahead of time, other
// URLs only get a connection.
async function preconnectCheckout() {
  const region = checkoutRegion();
  preconnect(`https://app.checkout.${region}.commercetools.com`);
  preconnect(`https://checkout.${region}.commercetools.com`, { crossOrigin: "anonymous" });
  if (process.env.CHECKOUT_BRAINTREE === "true") preconnect("https://assets.braintreegateway.com");
  const urls = (process.env.CHECKOUT_PRELOAD ?? "").split(",").flatMap((u) => {
    try {
      const url = new URL(u.trim());
      return url.protocol === "https:" ? [url] : [];
    } catch {
      return [];
    }
  });
  if (urls.length === 0) return;
  // Under 'strict-dynamic' a preloaded script needs the page's nonce.
  const nonce = nonceOf((await headers()).get("content-security-policy"));
  for (const url of urls) {
    preconnect(url.origin, { crossOrigin: "anonymous" });
    if (url.pathname.endsWith(".js")) preloadModule(url.href, { as: "script", crossOrigin: "anonymous", nonce });
  }
}
