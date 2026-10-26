"use client";

import { useActionState, useEffect, useState } from "react";
import type { BaseAddress } from "@commercetools/platform-sdk";
import { saveGuestDetails, type GuestDetailsState } from "@/features/checkout/actions";
import { AddressFields } from "@/features/account/components/AddressForm";
import { CheckoutStep } from "@/features/checkout/components/CheckoutStep";
import { keepFields, MethodTable } from "@/features/checkout/components/CheckoutForm";
import { useReportBusy } from "@/features/checkout/components/CheckoutStatus";
import type { MethodOption } from "@/features/checkout/utils";
import { FormGuardFields } from "@/components/ui/FormGuardFields";

// Guest checkout steps 1 and 2: email and shipping address (also used for billing), then the shipping method,
// saved together on the guest's cart.
export function GuestDetailsForm({
  email,
  address,
  countries,
  methods,
  methodKey,
}: {
  email?: string;
  address?: BaseAddress;
  countries: { code: string; name: string }[];
  methods: MethodOption[];
  methodKey?: string;
}) {
  const [state, action, pending] = useActionState(saveGuestDetails, {} as GuestDetailsState);
  // Edits after the last save must be saved before ordering: the order uses what's on the cart.
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (state.saved) setDirty(false);
  }, [state]);
  useReportBusy("guest-details", pending || dirty);
  return (
    <form action={action} onSubmit={keepFields(action)} onChange={() => setDirty(true)} className="flex flex-col gap-6">
      <FormGuardFields />
      <CheckoutStep step={1} title="Shipping address">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Email address
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            defaultValue={email}
            className="min-h-11 rounded border border-gray-300 px-3 text-base font-normal"
          />
          <span className="text-xs font-normal text-gray-600">
            We send your order confirmation here. You can create an account after checkout.
          </span>
        </label>
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="sr-only">Ship to</legend>
          <AddressFields address={address} countries={countries} />
        </fieldset>
      </CheckoutStep>

      <CheckoutStep step={2} title="Shipping methods">
        {/* Rates depend on the country: they are listed for the saved address (or the first country until then). */}
        <MethodTable methods={methods} methodKey={methodKey} required />
        {state.error && (
          <p role="alert" className="m-0 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            {state.error}
          </p>
        )}
        {dirty && !pending && <p className="m-0 text-sm text-orange-900">Save your changes before placing the order.</p>}
        {state.saved && !dirty && (
          <p role="status" className="m-0 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
            Saved. Check the order summary, then place your order below.
          </p>
        )}
        <button
          disabled={pending}
          className="min-h-11 self-end rounded bg-gray-900 px-6 font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save shipping details"}
        </button>
      </CheckoutStep>
    </form>
  );
}
