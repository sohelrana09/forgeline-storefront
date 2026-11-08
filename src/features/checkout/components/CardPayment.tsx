"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  cancelCardPayment,
  finishCardPayment,
  holdCardPayment,
  startCardPayment,
  type CardPaymentState,
} from "@/features/checkout/actions";
import { useCheckoutBusy } from "@/features/checkout/components/CheckoutStatus";
import { FormMessage } from "@/components/ui/PageMessages";
import { Message } from "@/components/ui/Message";
import {
  buildingCss,
  CHECKOUT_PAY_BUTTON,
  checkoutLookCss,
  flatMethodCss,
  layeredConnectorCss,
  methodReadySelector,
  pickCheckoutMethod,
  type CheckoutMethod,
} from "@/features/checkout/checkout-method";

// Card payment through commercetools Checkout (Payment Only). The server opens a session for the cart the buyer
// reviewed; the SDK renders the Application's payment methods inline (the data-ctc element), takes the payment
// through the Connector and creates the order. On success the server checks the order before clearing the cart.
// `paymentOpen`: the cart is locked for a payment opened earlier (another tab, or before a reload; features/cart/
// payment-lock.ts). Paying continues the same payment; cancelling removes the lock so the buyer can change the cart.
// `method`: the buyer's choice in the storefront's own list (PayPal or card). Checkout lists every method it has, so it
// is made to show only that one (features/checkout/checkout-method.ts); switching keeps the same session.
// The card fields and PayPal's button only exist inside a Checkout session, so the session opens as soon as card or
// PayPal is chosen and the cart is ready, with a soft lock that cart changes remove: the form is there when the buyer
// gets to it, without a click first. When the buyer edits steps 1-2 or the billing address, `onReset` closes it (the
// parent mounts a fresh one); once saved, a new session opens for the new total.
// Speed: Checkout builds its form in the browser through several services (its config, the connectors' config, the
// card connector's payment), so the SDK is fetched as soon as this mounts, and PaymentStep preconnects to Checkout's
// hosts. A loading line shows until the chosen method's fields or button are there.
// How long Checkout's script may take to load before the buyer is told card payment is unavailable.
const CHECKOUT_LOAD_MS = 15_000;
// How long a late script still clears that message.
const CHECKOUT_WATCH_MS = 3 * 60_000;
const CHECKOUT_UNAVAILABLE = "Online payment is unavailable right now. Please try again later.";
// Checkout's form is shown after this even when the chosen method's fields weren't recognised (its markup changed).
const SHOW_ANYWAY_MS = 12_000;
// A field frame that hasn't reported its load after this counts as loaded; once all have, the form shows after a short
// pause for the frames to draw their placeholders.
const FRAME_LOAD_MS = 2_000;
const FRAME_PAINT_MS = 120;
const LOADING = { card: "Loading secure payment…", paypal: "Loading PayPal…" };

export function CardPayment({
  cartVersion,
  ready,
  paymentOpen = false,
  payLabel,
  method,
  onReset,
  onLock,
}: {
  cartVersion: number;
  ready: boolean;
  paymentOpen?: boolean;
  payLabel: string;
  method: CheckoutMethod;
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
  // The buyer pressed Checkout's pay button in a soft session: the lock is now full (holdCardPayment).
  const [held, setHeld] = useState(false);
  const soft = state.session ? Boolean(state.soft) && !held : startingSoft;
  const open = starting || Boolean(state.session);
  useEffect(() => onLock?.(open && !soft), [open, soft, onLock]);

  // Fetched now, not once the session is open: one step less on the way to the form.
  useEffect(() => {
    import("@commercetools/checkout-browser-sdk").catch(() => undefined);
  }, []);

  // The card connector adds its own Tailwind stylesheet to <head>; it goes into the lowest layer as it arrives, so the
  // page keeps its spacing when the form loads (layeredConnectorCss). It stays watching: Checkout loads the connector
  // again for a new session. Already-wrapped sheets (a visit earlier in this tab) are left alone.
  useEffect(() => {
    const layer = (node: Node) => {
      if (!(node instanceof HTMLStyleElement)) return;
      const wrapped = layeredConnectorCss(node.textContent ?? "");
      if (wrapped) node.textContent = wrapped;
    };
    document.head.querySelectorAll("style").forEach(layer);
    const watch = new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach(layer)));
    watch.observe(document.head, { childList: true });
    return () => watch.disconnect();
  }, []);

  // Open the session once per cart version the buyer has saved, so the form shows without a click.
  const opened = useRef<number>(undefined);
  const opening = ready && !busy && !state.session;
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
  // The chosen method's fields or button are there: Checkout's form comes into view.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const root = ctc.current;
    if (!root) return;
    // The fields (or PayPal's button) are frames: they show once every one of them has loaded, so the placeholder never
    // gives way to empty boxes. A frame that doesn't report its load in time counts as loaded.
    const loaded = new WeakSet<HTMLIFrameElement>();
    const waiting = new WeakSet<HTMLIFrameElement>();
    const timers: number[] = [];
    const check = () => {
      const frames = [...root.querySelectorAll<HTMLIFrameElement>(methodReadySelector(method))];
      if (frames.length > 0 && frames.every((f) => loaded.has(f))) timers.push(window.setTimeout(() => setShown(true), FRAME_PAINT_MS));
    };
    const pick = () => {
      setPicked(pickCheckoutMethod(root, method) ? method : undefined);
      for (const frame of root.querySelectorAll<HTMLIFrameElement>(methodReadySelector(method))) {
        if (waiting.has(frame)) continue;
        waiting.add(frame);
        const done = () => {
          loaded.add(frame);
          check();
        };
        frame.addEventListener("load", done, { once: true });
        timers.push(window.setTimeout(done, FRAME_LOAD_MS));
      }
    };
    pick();
    const watch = new MutationObserver(pick);
    watch.observe(root, { childList: true, subtree: true });
    return () => {
      watch.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [method]);

  // Pressing Checkout's pay button turns the soft lock into a full one, as "Pay by card" does: the cart holds while
  // the buyer pays. PayPal's button is a frame, so a PayPal payment keeps the soft lock (changes are refused anyway
  // once its payment is running).
  const softSessionId = state.session && state.soft ? state.session.sessionId : undefined;
  useEffect(() => {
    const root = ctc.current;
    if (!root || !softSessionId) return;
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(CHECKOUT_PAY_BUTTON)) return;
      setHeld(true);
      holdCardPayment(softSessionId).catch(() => undefined);
    };
    root.addEventListener("click", onClick, true);
    return () => root.removeEventListener("click", onClick, true);
  }, [softSessionId]);

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
    const timer = window.setTimeout(() => setShown(true), SHOW_ANYWAY_MS);
    return () => window.clearTimeout(timer);
  }, [sessionId]);
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

  // The session is being opened (or is about to be), or Checkout is still building the chosen method's form.
  const openingNow = !state.session && (starting || (opening && !state.error));
  const loading = openingNow || (Boolean(state.session) && !shown && !problem);

  return (
    <div className="flex flex-col gap-3" data-checkout-flat="" data-flat={picked} data-shown={shown || problem ? "" : undefined}>
      <style>
        {[flatMethodCss("[data-checkout-flat]", method), checkoutLookCss("[data-checkout-flat]"), buildingCss("[data-checkout-flat]")].join(
          "\n",
        )}
      </style>
      {paymentOpen && (
        <Message type="warning">
          A payment is open for this cart, so it can&apos;t be changed. Pay below, or cancel the payment to change your cart.
        </Message>
      )}
      {/* Until the chosen method's fields or button are there, a stand-in of the same shape holds their place, so the
          payment box keeps its size while Checkout builds its form (no jump, no flash of a button that goes away). */}
      {!shown && !problem && !state.error && !finishing && (
        <>
          {(loading || busy) && (
            <p role="status" className="sr-only">
              {LOADING[method]}
            </p>
          )}
          <FormPlaceholder method={method} loading={loading || busy} />
        </>
      )}
      {/* Opening on its own failed: the buyer asks again. */}
      {!state.session && !openingNow && state.error && (
        <form action={start} onSubmit={() => setStartingSoft(true)} className="flex flex-col gap-3">
          {/* The version the buyer reviewed: if the cart changes meanwhile, paying fails instead of surprising them. */}
          <input type="hidden" name="cartVersion" value={cartVersion} />
          <input type="hidden" name="soft" value="1" />
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

// The card form or PayPal button as it will look (the card connector's labels and placeholders, white 44 px fields, the
// 48 px pay button), shown while Checkout builds it, so the real one replaces it without a visible change. Nothing in it
// moves or fades: the button's label says it is loading.
function FormPlaceholder({ method, loading }: { method: CheckoutMethod; loading: boolean }) {
  const label = "mb-1 block text-sm font-semibold text-gray-900";
  const field = (hint: string) => (
    <div className="flex h-11 items-center rounded border border-gray-300 bg-white px-3 text-base text-gray-400">{hint}</div>
  );
  const status = (
    <span className="flex items-center justify-center gap-2">
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      {loading ? LOADING[method] : PAY_LABEL[method]}
    </span>
  );
  return (
    // -mb-3: Checkout's form container sits under this, still empty, and its gap above would make this 12 px taller.
    <div aria-hidden="true" className="-mb-3 flex flex-col gap-4">
      {method === "card" ? (
        <>
          <div>
            <span className={label}>Card number</span>
            {field("1234 1234 1234 1234")}
          </div>
          <div className="grid grid-cols-2 items-end gap-4">
            <div>
              <span className={label}>Expiry date</span>
              {field("MM / YY")}
            </div>
            <div>
              <span className={label}>Security code (CVV)</span>
              {field("123")}
            </div>
          </div>
          <div className="flex min-h-12 items-center justify-center rounded bg-orange-700 text-base font-semibold text-white opacity-60">
            {status}
          </div>
        </>
      ) : (
        <div className="flex min-h-12 items-center justify-center rounded bg-gray-100 text-sm text-gray-600">
          {loading ? LOADING[method] : "PayPal"}
        </div>
      )}
    </div>
  );
}

const PAY_LABEL = { card: "Pay with credit card", paypal: "PayPal" };

// In development, every Checkout message goes to the browser console: its codes explain setup problems that the buyer
// only sees as "Unable to proceed with the checkout".
function devLog(kind: string, message: { code: string; payload?: unknown }) {
  if (process.env.NODE_ENV !== "production") console.info("checkout", kind, message.code, message.payload ?? "");
}
