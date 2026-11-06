"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { cancelCardPayment, finishCardPayment, startCardPayment, type CardPaymentState } from "@/features/checkout/actions";
import { useCheckoutBusy } from "@/features/checkout/components/CheckoutStatus";
import { FormMessage } from "@/components/ui/PageMessages";
import { Message } from "@/components/ui/Message";

// Card payment through commercetools Checkout (Payment Only). The server opens a session for the cart the buyer
// reviewed; the SDK renders the Application's payment methods inline (the data-ctc element), takes the payment
// through the Connector and creates the order. On success the server checks the order before clearing the cart.
// `paymentOpen`: the cart is frozen for a payment opened earlier (another tab, or before a reload). Paying continues on
// the same frozen cart; cancelling unfreezes it so the buyer can change it again.
// How long Checkout's script may take to load before the buyer is told card payment is unavailable.
const CHECKOUT_LOAD_MS = 15_000;
// How long a late script still clears that message.
const CHECKOUT_WATCH_MS = 3 * 60_000;
const CHECKOUT_UNAVAILABLE = "Card payment is unavailable right now. Please try again later.";

export function CardPayment({ cartVersion, ready, paymentOpen = false }: { cartVersion: number; ready: boolean; paymentOpen?: boolean }) {
  const [state, start, starting] = useActionState(startCardPayment, {} as CardPaymentState);
  const busy = useCheckoutBusy();
  const router = useRouter();
  const [problem, setProblem] = useState<string>();
  const [finishing, startFinishing] = useTransition();
  const mounted = useRef<string | undefined>(undefined);
  // After a failed payment Checkout expects paymentFlow again with the same session: bumping this re-mounts it.
  const [attempt, setAttempt] = useState(0);
  const [canRetry, setCanRetry] = useState(false);
  const [cancelling, startCancelling] = useTransition();
  // Unfreezes the cart, then reloads: the payment form Checkout mounted must go away with it.
  const cancel = () =>
    startCancelling(async () => {
      await cancelCardPayment();
      window.location.reload();
    });

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
              else router.push("/checkout?payment=unconfirmed"); // paid, and the order id didn't reach us
            }
          },
          onError: (message) => {
            if (message.code === "payment_failed") {
              setProblem("The payment didn't go through. Check the card details or try another card.");
              setCanRetry(true);
            } else if (message.code.endsWith("_error") || message.code.endsWith("_failed")) {
              setProblem(CHECKOUT_UNAVAILABLE);
              console.error("checkout", message.code);
            }
          },
        }),
      )
      // Setup problems (no active Application for this origin, connector down) reject here as well.
      .catch(() => setProblem(CHECKOUT_UNAVAILABLE));
  }, [state.session, state.reviewedCentAmount, attempt, router]);

  // The SDK only logs when Checkout's own script fails to load (blocked, offline): no callback, no rejection. That
  // script defines window.commercetoolsCheckout.render, so without it after a while, say so and offer a retry. It keeps
  // watching for a few minutes: on a slow connection the script can still arrive, and then the warning goes away.
  const sessionId = state.session?.sessionId;
  useEffect(() => {
    if (!sessionId) return;
    const started = Date.now();
    let warned = false;
    const watchdog = window.setInterval(() => {
      const loaded = typeof (window as { commercetoolsCheckout?: { render?: unknown } }).commercetoolsCheckout?.render === "function";
      const waited = Date.now() - started;
      if (loaded) {
        window.clearInterval(watchdog);
        if (warned) {
          // Only the watchdog's own warning: a payment error reported by Checkout meanwhile stays.
          setProblem((p) => (p === CHECKOUT_UNAVAILABLE ? undefined : p));
          setCanRetry(false);
        }
      } else if (!warned && waited > CHECKOUT_LOAD_MS) {
        warned = true;
        setProblem(CHECKOUT_UNAVAILABLE);
        setCanRetry(true);
      } else if (waited > CHECKOUT_WATCH_MS) window.clearInterval(watchdog);
    }, 500);
    return () => window.clearInterval(watchdog);
  }, [sessionId, attempt]);

  return (
    <div className="flex flex-col gap-3">
      {paymentOpen && !state.session && (
        <Message type="warning">
          A card payment is open for this cart, so it can&apos;t be changed. Pay below, or cancel the payment to change your cart.
        </Message>
      )}
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
      {(state.session || paymentOpen) && !finishing && (
        <button
          type="button"
          onClick={cancel}
          disabled={cancelling}
          className="min-h-11 self-start text-sm font-semibold text-gray-700 underline hover:text-gray-900 disabled:opacity-60"
        >
          {cancelling ? "Cancelling…" : "Cancel payment and change my cart"}
        </button>
      )}
      {finishing && <Message type="success">Payment received. Opening your order…</Message>}
      {/* Checkout renders the payment methods here (inline mode). */}
      <div data-ctc className="min-h-0" />
    </div>
  );
}
