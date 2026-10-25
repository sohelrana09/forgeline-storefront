"use client";

import { useActionState } from "react";
import { placeBankTransferOrderAction, type BankTransferState } from "@/features/checkout/actions";
import { keepFields, PlaceOrderButton } from "@/features/checkout/components/CheckoutForm";

// B2C fallback while card payments are switched off: place the order now, pay by bank transfer afterwards.
export function BankTransferForm({ cartVersion, ready }: { cartVersion: number; ready: boolean }) {
  const [state, action, pending] = useActionState(placeBankTransferOrderAction, {} as BankTransferState);
  return (
    <form action={action} onSubmit={keepFields(action)} className="flex flex-col gap-3">
      {/* The version the buyer reviewed: if the cart changes meanwhile, ordering fails instead of surprising them. */}
      <input type="hidden" name="cartVersion" value={cartVersion} />
      {state.error && (
        <p role="alert" className="m-0 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {state.error}
        </p>
      )}
      <PlaceOrderButton pending={pending} ready={ready} />
    </form>
  );
}
