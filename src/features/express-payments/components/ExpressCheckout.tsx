"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { cancelCardPayment, finishCardPayment } from "@/features/checkout/actions";
import {
  expressAddressAction,
  expressMethodAction,
  expressMethodsAction,
  expressSubmitAction,
  startExpressPayment,
} from "@/features/express-payments/actions";

// Wallet buttons (Apple Pay, Google Pay, PayPal: whatever the Checkout Application offers as express) on the cart.
// Nothing shows until Checkout says a method is available in this browser. Every callback goes to a Server Action on
// the buyer's own cart; a refusal there rejects the callback, which cancels the wallet sheet.
const ELEMENT_ID = "express-payment";

export function ExpressCheckout() {
  const [available, setAvailable] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [, startFinishing] = useTransition();
  const started = useRef(false);
  const reviewed = useRef<number>(NaN);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const start = await startExpressPayment();
      if (!start.ok) return; // not offered for this cart (empty, quote items, payment open): stay hidden
      const { session, countryCode, initialAmount } = start.value;
      const { expressPayment } = await import("@commercetools/checkout-browser-sdk");
      const unwrap = async <T,>(p: Promise<{ ok: true; value: T } | { ok: false; error: string }>): Promise<T> => {
        const r = await p;
        if (!r.ok) {
          setProblem(r.error);
          throw new Error(r.error);
        }
        return r.value;
      };
      expressPayment.init({
        projectKey: session.projectKey,
        region: session.region,
        sessionId: session.sessionId,
        countryCode,
        locale: "en",
        onInfo: (message) => {
          if (message.code === "checkout_completed") {
            const order = (message.payload as { order?: { id?: string } } | undefined)?.order;
            if (order?.id) startFinishing(() => finishCardPayment(order.id!, reviewed.current));
          }
        },
        onError: (message) => {
          if (message.code === "payment_failed" || message.code.endsWith("_cancelled")) {
            setProblem("The payment didn't go through. Try again or use the checkout.");
            // The cart was locked when the buyer confirmed: let them change it again.
            void cancelCardPayment();
          }
        },
      });
      const methods = await expressPayment.getAvailableMethods();
      if (methods.length === 0) return;
      setAvailable(true);
      await expressPayment.mount({
        expressId: ELEMENT_ID,
        initialAmount,
        onShippingAddressSelected: ({ address }) => unwrap(expressAddressAction(address)),
        getShippingMethods: () => unwrap(expressMethodsAction()),
        onShippingMethodSelected: ({ shippingMethod }) => unwrap(expressMethodAction(shippingMethod.id)),
        onPaymentSubmit: async (details) => {
          reviewed.current = await unwrap(expressSubmitAction(session.sessionId, details));
        },
      });
    })().catch(() => setAvailable(false));
  }, []);

  return (
    <section aria-label="Express checkout" hidden={!available && !problem} className="flex flex-col gap-2">
      <p className="m-0 text-center text-sm text-gray-600">Express checkout</p>
      <div id={ELEMENT_ID} className="min-h-12" />
      {problem && (
        <p role="alert" className="m-0 text-sm text-red-800">
          {problem}
        </p>
      )}
    </section>
  );
}
