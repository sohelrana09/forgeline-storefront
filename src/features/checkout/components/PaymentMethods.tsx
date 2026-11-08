"use client";

import { useCallback, useState, type ReactNode } from "react";
import { PlaceOrderForm } from "@/features/checkout/components/CheckoutForm";
import { BankTransferForm } from "@/features/checkout/components/BankTransferForm";
import { CardPayment } from "@/features/checkout/components/CardPayment";

export type PaymentKind = "invoice" | "bank-transfer" | "card" | "paypal";
export type PaymentOption = { kind: PaymentKind; title: string; description: string };

// Card and PayPal are both paid through commercetools Checkout, in one session: the buyer may switch between them
// while a payment is open, but not to another method until it is finished or cancelled.
const throughCheckout = (kind: PaymentKind): kind is "card" | "paypal" => kind === "card" || kind === "paypal";

const PAY_LABELS = { card: "Pay by card", paypal: "Continue with PayPal" };

// Flex `order` per position: option i sits at 2i, the chosen option's body right after it at 2i + 1. Literal class
// names, so Tailwind generates them.
const ORDER = ["order-0", "order-1", "order-2", "order-3", "order-4", "order-5", "order-6", "order-7"];

// One list of payment methods (radio rows in one box). The chosen row opens up: its body (the billing address shared by
// all methods, `children`, then that method's form and button) shows right under its title, inside the same row.
// The body is one element that only moves on screen (flex order), never in the DOM, and Checkout's form (card and
// PayPal) stays mounted in it whatever is chosen: it loads in the background as soon as the cart is ready, so choosing
// card shows the fields at once, and switching between methods never loads them again.
export function PaymentMethods({
  options,
  cartVersion,
  purchaseOrderNumber,
  ready,
  paymentOpen,
  children,
}: {
  options: PaymentOption[];
  cartVersion: number;
  purchaseOrderNumber?: string;
  ready: boolean;
  paymentOpen: boolean;
  // The billing address, at the top of the chosen method's body.
  children: ReactNode;
}) {
  const [selected, setSelected] = useState(options[0].kind);
  const [locked, setLocked] = useState(false);
  // Bumped to mount a fresh CardPayment when its soft session goes stale (the buyer is changing the cart).
  const [round, setRound] = useState(0);
  const reset = useCallback(() => {
    setLocked(false);
    setRound((r) => r + 1);
  }, []);
  // The Checkout method the hidden form is built for: the last one chosen, else the first offered.
  const firstCheckout = options.map((o) => o.kind).find(throughCheckout);
  const [checkoutMethod, setCheckoutMethod] = useState(firstCheckout ?? "card");
  const choose = (kind: PaymentKind) => {
    setSelected(kind);
    if (throughCheckout(kind)) setCheckoutMethod(kind);
  };
  const choosing = options.length > 1;
  const position = Math.max(
    0,
    options.findIndex((o) => o.kind === selected),
  );
  const chosen = options[position];
  const checkoutShown = throughCheckout(selected);

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="sr-only">Payment method</legend>
      <div className="flex flex-col overflow-hidden rounded-md border border-b-0 border-gray-200 bg-white">
        {options.map((option, i) => {
          const active = option.kind === selected;
          const disabled = locked && !throughCheckout(option.kind);
          return (
            <label
              key={option.kind}
              className={`${ORDER[i * 2]} flex items-start gap-3 px-4 py-3.5 ${active ? "bg-orange-50/60" : "border-b border-gray-200 hover:bg-gray-50"} ${
                choosing && !disabled ? "cursor-pointer" : ""
              } ${disabled ? "opacity-60" : ""}`}
            >
              {choosing ? (
                <input
                  type="radio"
                  name="paymentMethod"
                  value={option.kind}
                  checked={active}
                  disabled={disabled}
                  onChange={() => choose(option.kind)}
                  className="mt-0.5 size-4 shrink-0 accent-orange-700"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-orange-700"
                >
                  <span className="size-2 rounded-full bg-orange-700" />
                </span>
              )}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-semibold text-gray-900">{option.title}</span>
                <span className="text-sm text-gray-600">{option.description}</span>
              </span>
            </label>
          );
        })}
        {/* The chosen method's body, the lower part of its row. */}
        <div
          role="group"
          aria-label={chosen.title}
          className={`${ORDER[position * 2 + 1]} flex flex-col gap-5 border-b border-gray-200 bg-orange-50/60 px-4 pb-5 sm:pl-11`}
        >
          {/* A payment opened in this tab with a full lock holds the cart, billing address included. */}
          <fieldset disabled={locked} className="m-0 min-w-0 rounded border border-gray-200 bg-white p-4">
            {children}
          </fieldset>
          {selected === "invoice" && <PlaceOrderForm cartVersion={cartVersion} purchaseOrderNumber={purchaseOrderNumber} ready={ready} />}
          {selected === "bank-transfer" && <BankTransferForm cartVersion={cartVersion} ready={ready} />}
          {firstCheckout && (
            // Mounted for as long as card or PayPal is offered (see above); out of sight and inert while another method is
            // chosen. It keeps its width, so Checkout's frames lay out normally while hidden.
            <div inert={!checkoutShown} aria-hidden={!checkoutShown} className={checkoutShown ? "" : "h-0 overflow-hidden"}>
              <CardPayment
                key={round}
                cartVersion={cartVersion}
                ready={ready}
                paymentOpen={paymentOpen}
                method={checkoutMethod}
                onReset={reset}
                payLabel={PAY_LABELS[checkoutMethod]}
                onLock={setLocked}
              />
            </div>
          )}
        </div>
      </div>
    </fieldset>
  );
}
