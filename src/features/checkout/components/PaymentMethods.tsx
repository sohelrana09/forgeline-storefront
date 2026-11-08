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

// One list of payment methods (radio buttons). The chosen method opens up: its body (the billing address shared by
// all methods, `children`, then that method's form and button) shows inside its box, right under its title.
// The body is one element that only moves on screen (flex order), never in the DOM: switching between card and PayPal
// keeps the open Checkout session and its form instead of loading them again.
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
  const choosing = options.length > 1;
  const position = Math.max(
    0,
    options.findIndex((o) => o.kind === selected),
  );
  const chosen = options[position];

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="sr-only">Payment method</legend>
      <div className="flex flex-col gap-2">
        {options.map((option, i) => {
          const active = option.kind === selected;
          const disabled = locked && !throughCheckout(option.kind);
          return (
            <label
              key={option.kind}
              className={`${ORDER[i * 2]} border-2 p-4 ${
                active ? "rounded-t border-b-0 border-orange-700 bg-orange-50" : "rounded border-gray-200 bg-white"
              } ${choosing && !disabled ? "cursor-pointer" : ""} ${disabled ? "opacity-60" : ""}`}
            >
              <span className="flex items-center gap-3 font-semibold">
                {choosing ? (
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={option.kind}
                    checked={active}
                    disabled={disabled}
                    onChange={() => setSelected(option.kind)}
                    className="size-4 accent-orange-700"
                  />
                ) : (
                  <span aria-hidden="true" className="flex size-4 items-center justify-center rounded-full border-2 border-orange-700">
                    <span className="size-2 rounded-full bg-orange-700" />
                  </span>
                )}
                {option.title}
              </span>
              <span className="mt-1 block pl-7 text-sm text-gray-700">{option.description}</span>
            </label>
          );
        })}
        {/* The chosen method's body, drawn as the lower part of its box (the gap above it is taken back). */}
        <div
          role="group"
          aria-label={chosen.title}
          className={`${ORDER[position * 2 + 1]} -mt-2 flex flex-col gap-4 rounded-b border-2 border-t-0 border-orange-700 bg-white p-4`}
        >
          {/* A payment opened in this tab with a full lock holds the cart, billing address included. */}
          <fieldset disabled={locked} className="m-0 min-w-0 border-0 p-0">
            {children}
          </fieldset>
          {selected === "invoice" ? (
            <PlaceOrderForm cartVersion={cartVersion} purchaseOrderNumber={purchaseOrderNumber} ready={ready} />
          ) : throughCheckout(selected) ? (
            // One element for both methods, so switching between them keeps the open Checkout session.
            <CardPayment
              key={round}
              cartVersion={cartVersion}
              ready={ready}
              paymentOpen={paymentOpen}
              method={selected}
              onReset={reset}
              payLabel={PAY_LABELS[selected]}
              onLock={setLocked}
            />
          ) : (
            <BankTransferForm cartVersion={cartVersion} ready={ready} />
          )}
        </div>
      </div>
    </fieldset>
  );
}
