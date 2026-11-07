"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import { cancelCardPayment, finishCardPayment, startCardPayment, type CardPaymentState } from "@/features/checkout/actions";
import { useCheckoutBusy } from "@/features/checkout/components/CheckoutStatus";
import { FormMessage } from "@/components/ui/PageMessages";
import { Message } from "@/components/ui/Message";
import { checkoutLookCss, flatMethodCss, pickCheckoutMethod, type CheckoutMethod } from "@/features/checkout/checkout-method";

// Card payment through commercetools Checkout (Payment Only). The server opens a session for the cart the buyer
// reviewed; the SDK renders the Application's payment methods inline (the data-ctc element), takes the payment
// through the Connector and creates the order. On success the server checks the order before clearing the cart.
// `paymentOpen`: the cart is locked for a payment opened earlier (another tab, or before a reload; features/cart/
// payment-lock.ts). Paying continues the same payment; cancelling removes the lock so the buyer can change the cart.
// `method`: the buyer's choice in the storefront's own list (PayPal or card). Checkout lists every method it has, so it
// is made to show only that one (features/checkout/checkout-method.ts); switching keeps the same session.
// `auto` (PayPal): PayPal's button only exists inside a Checkout session, so the session opens as soon as PayPal is
// chosen and the cart is ready, with a soft lock that cart changes remove. When the buyer edits steps 1-2 or the billing
// address, `onReset` closes it (the parent mounts a fresh one); once saved, a new session opens for the new total.
// How long Checkout's script may take to load before the buyer is told card payment is unavailable.
const CHECKOUT_LOAD_MS = 15_000;
// How long a late script still clears that message.
const CHECKOUT_WATCH_MS = 3 * 60_000;
const CHECKOUT_UNAVAILABLE = "Online payment is unavailable right now. Please try again later.";

export function CardPayment({
  cartVersion,
  ready,
  paymentOpen = false,
  payLabel,
  method,
  auto = false,
  onReset,
  onLock,
}: {
  cartVersion: number;
  ready: boolean;
  paymentOpen?: boolean;
  payLabel: string;
  method: CheckoutMethod;
  // Opens the session without a click (PayPal).
  auto?: boolean;
  // Asks for a fresh component: the buyer is changing the cart under a soft session.
  onReset?: () => void;
  // Told when a payment is being opened or is open with a full lock, and when it no longer is.
  onLock?: (locked: boolean) => void;
}) {
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
  // Unlocks the cart, then reloads: the payment form Checkout mounted must go away with it.
  const cancel = () =>
    startCancelling(async () => {
      await cancelCardPayment();
      window.location.reload();
    });

  // Whether the session being opened, or the one open, holds only a soft lock.
  const [startingSoft, setStartingSoft] = useState(false);
  const soft = state.session ? Boolean(state.soft) : startingSoft;
  const open = starting || Boolean(state.session);
  useEffect(() => onLock?.(open && !soft), [open, soft, onLock]);

  // PayPal: open the session once per cart version the buyer has saved, so its button shows without a click.
  const opened = useRef<number>(undefined);
  const opening = auto && ready && !busy && !state.session;
  useEffect(() => {
    if (!opening || starting || opened.current === cartVersion) return;
    opened.current = cartVersion;
    const formData = new FormData();
    formData.set("cartVersion", String(cartVersion));
    formData.set("soft", "1");
    setStartingSoft(true);
    startTransition(() => start(formData));
  }, [opening, starting, cartVersion, start]);

  // Steps 1-2 or the billing address are being changed: that removes the soft lock on the server, so this session is
  // for a total that is going away.
  const stale = busy && Boolean(state.session) && soft;
  useEffect(() => {
    if (stale) onReset?.();
  }, [stale, onReset]);

  // Checkout's own list follows the buyer's choice; it is hidden only once the chosen method was found there.
  const ctc = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<CheckoutMethod>();
  useEffect(() => {
    const root = ctc.current;
    if (!root) return;
    const pick = () => setPicked(pickCheckoutMethod(root, method) ? method : undefined);
    pick();
    const watch = new MutationObserver(pick);
    watch.observe(root, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [method]);

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
            devLog("info", message);
            if (message.code === "checkout_completed") {
              const order = (message.payload as { order?: { id?: string } } | undefined)?.order;
              if (order?.id) startFinishing(() => finishCardPayment(order.id!, state.reviewedCentAmount ?? NaN));
              else router.push("/checkout?payment=unconfirmed"); // paid, and the order id didn't reach us
            }
          },
          onWarn: (message) => devLog("warn", message),
          onError: (message) => {
            devLog("error", message);
            if (message.code === "payment_failed") {
              setProblem("The payment didn't go through. Check your details or try another payment method.");
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
    <div className="flex flex-col gap-3" data-checkout-flat="" data-flat={picked}>
      <style>{`${flatMethodCss("[data-checkout-flat]", method)}\n${checkoutLookCss("[data-checkout-flat]")}`}</style>
      {paymentOpen && !state.session && !auto && (
        <Message type="warning">
          A payment is open for this cart, so it can&apos;t be changed. Pay below, or cancel the payment to change your cart.
        </Message>
      )}
      {auto && !state.session && (starting || (opening && !state.error)) && (
        <p role="status" className="m-0 text-sm text-gray-700">
          Loading PayPal…
        </p>
      )}
      {!state.session && !(auto && (starting || (opening && !state.error))) && (
        <form action={start} onSubmit={() => setStartingSoft(auto)} className="flex flex-col gap-3">
          {/* The version the buyer reviewed: if the cart changes meanwhile, paying fails instead of surprising them. */}
          <input type="hidden" name="cartVersion" value={cartVersion} />
          {auto && <input type="hidden" name="soft" value="1" />}
          <button
            disabled={starting || !ready || busy}
            className="min-h-12 rounded bg-orange-700 px-5 text-base font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
          >
            {starting ? "Opening secure payment…" : payLabel}
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
      {(state.session || paymentOpen) && !finishing && !soft && (
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
      <div ref={ctc} data-ctc className="min-h-0" />
    </div>
  );
}

// In development, every Checkout message goes to the browser console: its codes explain setup problems that the buyer
// only sees as "Unable to proceed with the checkout".
function devLog(kind: string, message: { code: string; payload?: unknown }) {
  if (process.env.NODE_ENV !== "production") console.info("checkout", kind, message.code, message.payload ?? "");
}
