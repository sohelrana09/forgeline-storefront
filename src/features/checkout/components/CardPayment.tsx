"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { finishCardPayment, startCardPayment, type CardPaymentState } from "@/features/checkout/actions";
import { useCheckoutBusy } from "@/features/checkout/components/CheckoutStatus";
import { FormMessage } from "@/components/ui/PageMessages";
import { Message } from "@/components/ui/Message";

// Card payment through commercetools Checkout (Payment Only). The server opens a session for the cart the buyer
// reviewed; the SDK renders the Application's payment methods inline (the data-ctc element), takes the payment
// through the Connector and creates the order. On success the server checks the order before clearing the cart.
export function CardPayment({ cartVersion, ready }: { cartVersion: number; ready: boolean }) {
  const [state, start, starting] = useActionState(startCardPayment, {} as CardPaymentState);
  const busy = useCheckoutBusy();
  const [problem, setProblem] = useState<string>();
  const [finishing, startFinishing] = useTransition();
  const mounted = useRef<string | undefined>(undefined);
  // After a failed payment Checkout expects paymentFlow again with the same session: bumping this re-mounts it.
  const [attempt, setAttempt] = useState(0);
  const [canRetry, setCanRetry] = useState(false);

  useEffect(() => {
    const session = state.session;
    const mountKey = session && `${session.sessionId}#${attempt}`;
    if (!session || mounted.current === mountKey) return;
    mounted.current = mountKey;
    setCanRetry(false);
    setProblem(undefined);
    // Loaded on demand: the SDK touches window and is only needed once the buyer chooses to pay.
    import("@commercetools/checkout-browser-sdk")
      .then(({ paymentFlow }) =>
        paymentFlow({
          projectKey: session.projectKey,
          region: session.region,
          sessionId: session.sessionId,
          locale: "en",
          currencyLocale: "en-GB",
          onInfo: (message) => {
            if (message.code === "checkout_completed") {
              const order = (message.payload as { order?: { id?: string } } | undefined)?.order;
              if (order?.id) startFinishing(() => finishCardPayment(order.id!, state.reviewedCentAmount ?? NaN));
            }
          },
          onError: (message) => {
            if (message.code === "payment_failed") {
              setProblem("The payment didn't go through. Check the card details or try another card.");
              setCanRetry(true);
            } else if (message.code.endsWith("_error") || message.code.endsWith("_failed")) {
              setProblem("Card payment is unavailable right now. Please try again later.");
              console.error("checkout", message.code);
            }
          },
        }),
      )
      // Setup problems (no active Application for this origin, connector down) reject here as well.
      .catch(() => setProblem("Card payment is unavailable right now. Please try again later."));
  }, [state.session, state.reviewedCentAmount, attempt]);

  return (
    <div className="flex flex-col gap-3">
      {!state.session && (
        <form action={start} className="flex flex-col gap-3">
          {/* The version the buyer reviewed: if the cart changes meanwhile, paying fails instead of surprising them. */}
          <input type="hidden" name="cartVersion" value={cartVersion} />
          <button
            disabled={starting || !ready || busy}
            className="min-h-12 rounded bg-orange-700 px-5 text-base font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
          >
            {starting ? "Opening secure payment…" : "Pay by card"}
          </button>
        </form>
      )}
      <FormMessage state={state} error={state.error} />
      <FormMessage state={problem} error={problem} />
      {canRetry && (
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="min-h-11 self-start rounded border border-gray-300 bg-white px-4 text-sm font-semibold hover:bg-gray-50"
        >
          Try again
        </button>
      )}
      {finishing && <Message type="success">Payment received. Opening your order…</Message>}
      {/* Checkout renders the payment methods here (inline mode). */}
      <div data-ctc className="min-h-0" />
    </div>
  );
}
