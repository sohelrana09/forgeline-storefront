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

// One flat list of payment methods: radio buttons (one method shows as selected), then the billing
// address shared by all of them (`children`), then the chosen method's form and button.
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
  // The billing address, between the methods and the form.
  children: ReactNode;
}) {
  const [selected, setSelected] = useState(options[0].kind);
  const [locked, setLocked] = useState(false);
  // Bumped to mount a fresh CardPayment when its PayPal session goes stale (the buyer is changing the cart).
  const [round, setRound] = useState(0);
  const reset = useCallback(() => {
    setLocked(false);
    setRound((r) => r + 1);
  }, []);
  const choosing = options.length > 1;

  return (
    <>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="sr-only">Payment method</legend>
        {options.map((option) => {
          const active = option.kind === selected;
          const disabled = locked && !throughCheckout(option.kind);
          return (
            <label
              key={option.kind}
              className={`rounded border-2 p-4 ${active ? "border-orange-700 bg-orange-50" : "border-gray-200 bg-white"} ${
                choosing && !disabled ? "cursor-pointer" : ""
              } ${disabled ? "opacity-60" : ""}`}
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
      </fieldset>
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
          auto={selected === "paypal"}
          onReset={reset}
          payLabel={PAY_LABELS[selected]}
          onLock={setLocked}
        />
      ) : (
        <BankTransferForm cartVersion={cartVersion} ready={ready} />
      )}
    </>
  );
}
