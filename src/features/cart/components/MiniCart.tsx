"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { MiniCartBadge } from "@/components/layouts/MiniCartBadge";
import { updateCartLine } from "@/features/cart/actions";
import { CART_CHANGED, EMPTY_MINICART, type MiniCartLine, type MiniCartSummary } from "@/features/cart/minicart";

const MAX_QUANTITY = 9999;
const AUTO_SAVE_MS = 500;
const FAILED_SAVE_MS = 4000;
const stepButton =
  "flex w-9 shrink-0 items-center justify-center text-base font-semibold text-gray-800 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-orange-700";

// Magento-style minicart: the header cart opens a dropdown with the lines (quantity update, remove), the subtotal,
// "Proceed to Checkout" and "View and Edit Cart" (only while the cart has products; empty shows just a message).
// Without JavaScript the cart icon is a plain link to /cart.
//   - per-visitor pages pass `initial`, built from the cart on the server (SiteChrome);
//   - cached guest pages pass `live`: the page is shared, so the visitor's own cart is loaded here from
//     /api/cart-summary.
// Anything that changes the cart fires CART_CHANGED (AddToCartForm, the lines below), which reloads the summary.
export function MiniCart({ initial = EMPTY_MINICART, live = false }: { initial?: MiniCartSummary; live?: boolean }) {
  const [summary, setSummary] = useState(initial);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLAnchorElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const panelId = useId();
  const pathname = usePathname();

  // A server re-render (after an action revalidates the page) brings a newer cart.
  useEffect(() => setSummary(initial), [initial]);

  const load = useCallback(() => {
    fetch("/api/cart-summary", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<MiniCartSummary>) : undefined))
      .then((s) => s && setSummary(s))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let lastLoad = 0;
    const loadNow = () => {
      lastLoad = Date.now();
      load();
    };
    // Coming back to the tab picks up changes from other tabs, at most every 30 s (each load reads the cart).
    const loadOnFocus = () => {
      if (Date.now() - lastLoad > 30_000) loadNow();
    };
    if (live) loadNow();
    window.addEventListener(CART_CHANGED, loadNow);
    if (live) window.addEventListener("focus", loadOnFocus);
    return () => {
      window.removeEventListener(CART_CHANGED, loadNow);
      window.removeEventListener("focus", loadOnFocus);
    };
  }, [live, load]);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) toggle.current?.focus();
  }, []);

  // Closes on navigation, Esc and a click outside.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    heading.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(true);
    // Outside means outside on screen: the event path (taken at dispatch, so a row re-rendering meanwhile doesn't
    // matter) and, as a fallback, the panel's box (a press on a disabled control can be reported on its parent).
    const onPointer = (e: PointerEvent) => {
      if (root.current && e.composedPath().includes(root.current)) return;
      const box = document.getElementById(panelId)?.getBoundingClientRect();
      if (box && e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom) return;
      close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close, panelId]);

  const label = `Cart, ${summary.items} ${summary.items === 1 ? "item" : "items"}${summary.total ? `, ${summary.total}` : ""}`;

  return (
    <div ref={root} className="relative ml-auto sm:ml-0">
      <Link
        ref={toggle}
        href="/cart"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className="flex items-center gap-3 text-gray-50 no-underline hover:text-white"
      >
        <MiniCartBadge items={summary.items} total={summary.total} />
      </Link>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Shopping cart"
          className="absolute right-0 top-full z-50 mt-3 w-[22rem] max-w-[calc(100vw-2rem)] rounded-md border border-gray-200 bg-white text-gray-800 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 ref={heading} tabIndex={-1} className="m-0 text-base font-semibold outline-none">
              {summary.items === 0 ? "My cart" : `${summary.items} ${summary.items === 1 ? "item" : "items"} in cart`}
            </h2>
            <button
              type="button"
              onClick={() => close(true)}
              aria-label="Close cart"
              className="flex h-9 w-9 items-center justify-center rounded text-xl text-gray-600 hover:bg-gray-100"
            >
              ×
            </button>
          </div>

          {summary.lines.length === 0 ? (
            <p className="m-0 px-4 py-6 text-sm text-gray-600">You have no items in your shopping cart.</p>
          ) : (
            <>
              <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3">
                <p className="m-0 flex items-baseline justify-between text-sm">
                  <span className="text-gray-600">Cart subtotal</span>
                  <span className="text-lg font-bold">{summary.subtotal}</span>
                </p>
                {summary.canOrder && summary.lines.length > 0 && (
                  <Link
                    href={summary.hasQuoteLines ? "/cart" : "/checkout"}
                    className="flex min-h-11 items-center justify-center rounded bg-orange-700 px-4 font-semibold text-white no-underline hover:bg-orange-800"
                  >
                    {summary.hasQuoteLines ? "Request a quote" : "Proceed to Checkout"}
                  </Link>
                )}
              </div>
              <ul className="m-0 max-h-80 list-none overflow-y-auto p-0">
                {summary.lines.map((line) => (
                  <MiniCartRow key={line.id} line={line} editable={summary.canOrder} />
                ))}
              </ul>
            </>
          )}

          {summary.lines.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-3 text-center">
              <Link href="/cart" className="text-sm font-semibold text-orange-800">
                View and Edit Cart
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// One line: picture, name, unit price, and (when the visitor may change the cart) the quantity with an Update button
// that appears once it differs, plus Remove with a confirmation step (Magento asks before removing).
function MiniCartRow({ line, editable }: { line: MiniCartLine; editable: boolean }) {
  const [quantity, setQuantity] = useState(String(line.quantity));
  const [confirming, setConfirming] = useState(false);
  // Typed quantity (Update) and Remove show progress; − and + save quietly in the background.
  const [pending, startTransition] = useTransition();
  const [saving, startSaving] = useTransition();
  // − and + save on their own, once the clicks stop: a burst of clicks is one request with the final quantity.
  const autoSave = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [stepping, setStepping] = useState(false);
  const steppingNow = useRef(false);
  // The quantity last sent: an older save landing in between must not flash its number.
  const requested = useRef<number | undefined>(undefined);
  const latest = useRef(line.quantity);
  latest.current = line.quantity;
  useEffect(() => () => clearTimeout(autoSave.current), []);
  // Shows the cart's quantity only when the cart's value changes (a save landing, another tab, the cart page), never
  // while clicks are still coming, and not an older save's result while a newer one is on its way.
  useEffect(() => {
    if (steppingNow.current) return;
    if (requested.current !== undefined) {
      if (line.quantity !== requested.current) return;
      requested.current = undefined;
    }
    setQuantity(String(line.quantity));
  }, [line.quantity]);
  const n = Number(quantity);
  const valid = Number.isInteger(n) && n >= 1 && n <= MAX_QUANTITY;

  const save = (next: number | "remove", quietly = false) => {
    const formData = new FormData();
    formData.set("lineItemId", line.id);
    if (next === "remove") formData.set("intent", "remove");
    else formData.set("quantity", String(next));
    if (next !== "remove") requested.current = next;
    (quietly ? startSaving : startTransition)(async () => {
      await updateCartLine(formData);
      window.dispatchEvent(new Event(CART_CHANGED));
      // If the cart never reaches the quantity asked for (the save failed), show what the cart really has.
      setTimeout(() => {
        if (requested.current === next && !steppingNow.current) {
          requested.current = undefined;
          setQuantity(String(latest.current));
        }
      }, FAILED_SAVE_MS);
    });
  };

  const step = (delta: 1 | -1) => {
    const next = Math.min(MAX_QUANTITY, Math.max(1, (valid ? n : line.quantity) + delta));
    setQuantity(String(next));
    clearTimeout(autoSave.current);
    setStepping(true);
    steppingNow.current = true;
    autoSave.current = setTimeout(() => {
      setStepping(false);
      steppingNow.current = false;
      if (next !== line.quantity) save(next, true);
    }, AUTO_SAVE_MS);
  };

  return (
    <li className={`flex gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 ${pending ? "opacity-60" : ""}`}>
      {line.image ? (
        <Image
          src={line.image}
          alt=""
          width={56}
          height={56}
          sizes="56px"
          className="h-14 w-14 flex-none rounded bg-gray-50 object-contain"
        />
      ) : (
        <span aria-hidden="true" className="h-14 w-14 flex-none rounded bg-gray-100" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link href={line.href} className="text-sm font-semibold leading-snug text-gray-900">
          {line.name}
        </Link>
        <span className="text-sm text-gray-700">{line.quoteOnly ? "Priced on quote" : line.price}</span>
        {editable ? (
          confirming ? (
            <div role="alert" className="flex flex-wrap items-center gap-2 text-xs">
              <span>Remove this item?</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => save("remove")}
                className="min-h-8 rounded bg-red-700 px-2 font-semibold text-white"
              >
                Remove
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="min-h-8 rounded border border-gray-300 px-2">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {/* − [qty] + like QuantityInput on the cart page, but controlled; stays usable while a save runs. */}
              <div className="flex h-9 items-stretch overflow-hidden rounded border border-gray-300 bg-white">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  disabled={pending || (valid && n <= 1)}
                  aria-label={`Decrease quantity of ${line.name}`}
                  className={stepButton}
                >
                  <span aria-hidden="true">−</span>
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_QUANTITY}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && valid && n !== line.quantity && save(n)}
                  aria-label={`Quantity of ${line.name}`}
                  className="w-12 min-w-0 border-x border-gray-300 text-center text-sm text-gray-900 [appearance:textfield] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-orange-700 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => step(1)}
                  disabled={pending || (valid && n >= MAX_QUANTITY)}
                  aria-label={`Increase quantity of ${line.name}`}
                  className={stepButton}
                >
                  <span aria-hidden="true">+</span>
                </button>
              </div>
              {/* A spinner (no text) while the quantity saves; screen readers hear "Saving". */}
              {(saving || pending) && (
                <span role="status" className="flex h-8 w-8 items-center justify-center text-orange-700">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 animate-spin" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  <span className="sr-only">Saving</span>
                </span>
              )}
              {/* Typed quantities still need Update (or Enter); − and + save on their own. */}
              {valid && n !== line.quantity && !stepping && !saving && !pending && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => save(n)}
                  className="min-h-8 rounded border border-gray-900 px-2 text-xs font-semibold disabled:opacity-60"
                >
                  Update
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirming(true)}
                aria-label={`Remove ${line.name}`}
                className="ml-auto min-h-8 px-1 text-xs text-red-800 underline underline-offset-2"
              >
                Remove
              </button>
            </div>
          )
        ) : (
          <span className="text-xs text-gray-600">Qty {line.quantity}</span>
        )}
      </div>
    </li>
  );
}
