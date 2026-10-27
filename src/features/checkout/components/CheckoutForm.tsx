"use client";

import Link from "next/link";
import { startTransition, useActionState, type FormEvent } from "react";
import { chooseDelivery, placeOrderAction, type DeliveryState, type PlaceOrderState } from "@/features/checkout/actions";
import { CheckoutStep } from "@/features/checkout/components/CheckoutStep";
import type { MethodOption } from "@/features/checkout/utils";
import { useCheckoutBusy, useReportBusy } from "@/features/checkout/components/CheckoutStatus";
import { FormMessage } from "@/components/ui/PageMessages";

type AddressOption = { key: string; label: string };

// Steps 1 and 2 of the one-step checkout for signed-in customers: pick a saved address, then a shipping method.
// Each change is saved to the cart right away, so the methods and the summary always match the chosen address.
export function DeliveryForm({
  addresses,
  addressId,
  methods,
  methodKey,
  addAddressHref,
}: {
  addresses: AddressOption[];
  addressId?: string;
  methods: MethodOption[];
  methodKey?: string;
  addAddressHref?: string;
}) {
  const [state, action, pending] = useActionState(chooseDelivery, {} as DeliveryState);
  const submitOnChange = (e: React.ChangeEvent<HTMLInputElement>) => e.currentTarget.form?.requestSubmit();
  return (
    <form action={action} className="flex flex-col gap-6">
      <CheckoutStep step={1} title="Shipping address">
        <fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-2">
          <legend className="sr-only">Ship to</legend>
          {addresses.map((a) => (
            <label
              key={a.key}
              className="flex cursor-pointer items-start gap-3 rounded border-2 border-gray-200 p-4 has-[:checked]:border-orange-700 has-[:checked]:bg-orange-50"
            >
              <input
                type="radio"
                name="addressId"
                value={a.key}
                defaultChecked={a.key === addressId}
                onChange={submitOnChange}
                className="mt-1"
              />
              <span className="whitespace-pre-line text-sm">{a.label}</span>
            </label>
          ))}
        </fieldset>
        {addAddressHref && (
          <Link
            href={addAddressHref}
            className="self-start rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 no-underline hover:bg-gray-50"
          >
            + New address
          </Link>
        )}
      </CheckoutStep>

      <CheckoutStep step={2} title="Shipping methods" waitingFor={addressId ? undefined : "Choose a shipping address first."}>
        <MethodTable methods={methods} methodKey={methodKey} onChange={submitOnChange} />
      </CheckoutStep>
      <SavingNote pending={pending} />
      <FormMessage state={state} error={state.error} />
      <noscript>
        <button className="min-h-11 rounded border border-gray-300 px-4">Save shipping</button>
      </noscript>
    </form>
  );
}

// Saving an address or method takes a moment: say so, since the totals and step 3 change once it's done.
function SavingNote({ pending }: { pending: boolean }) {
  useReportBusy("delivery", pending);
  return (
    <p role="status" className="m-0 -mt-3 min-h-5 text-sm text-gray-600">
      {pending ? "Saving your choice and updating the total…" : ""}
    </p>
  );
}

// Shipping methods table: choice · price · method.
export function MethodTable({
  methods,
  methodKey,
  onChange,
  required,
}: {
  methods: MethodOption[];
  methodKey?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}) {
  if (methods.length === 0) return <p className="m-0 text-sm text-red-800">Sorry, no shipping method delivers to this address.</p>;
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="sr-only">Shipping method</legend>
      <div className="flex flex-col divide-y divide-gray-200 rounded border border-gray-200">
        {methods.map((m) => (
          <label key={m.key} className="flex min-h-12 cursor-pointer items-center gap-4 px-4 py-3 text-sm has-[:checked]:bg-orange-50">
            <input
              type="radio"
              name="shippingMethodKey"
              value={m.key}
              defaultChecked={m.key === methodKey}
              onChange={onChange}
              required={required}
            />
            <span className="w-24 shrink-0 font-semibold">{m.price}</span>
            <span className="flex min-w-0 flex-col">
              <span>{m.name}</span>
              {m.note && <span className="text-xs text-gray-600">{m.note}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Business orders (step 3): purchase order number and payment on company invoice.
export function PlaceOrderForm({
  cartVersion,
  purchaseOrderNumber,
  ready,
}: {
  cartVersion: number;
  purchaseOrderNumber?: string;
  ready: boolean;
}) {
  const [state, action, pending] = useActionState(placeOrderAction, {} as PlaceOrderState);
  return (
    <form action={action} onSubmit={keepFields(action)} className="flex flex-col gap-3">
      {/* The version the buyer reviewed: if the cart changes meanwhile, ordering fails instead of surprising them. */}
      <input type="hidden" name="cartVersion" value={cartVersion} />
      <label className="flex flex-col gap-1 text-sm font-semibold sm:max-w-sm">
        Purchase order number (optional)
        <input
          name="purchaseOrderNumber"
          maxLength={35}
          defaultValue={purchaseOrderNumber}
          placeholder="e.g. PO-4711"
          className="min-h-11 rounded border border-gray-300 px-3 font-normal"
        />
      </label>
      <FormMessage state={state} error={state.error} />
      <PlaceOrderButton pending={pending} ready={ready} />
    </form>
  );
}

// With JavaScript, submit through a transition instead of the form action: React resets a form after its action
// runs, which would wipe what the buyer typed when the server answers with an error. Without JavaScript the form
// still posts normally.
export const keepFields = (dispatch: (formData: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const formData = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
  startTransition(() => dispatch(formData));
};

// Waits while steps 1-2 are saving or have unsaved edits (see CheckoutStatus).
export function PlaceOrderButton({ pending, ready }: { pending: boolean; ready: boolean }) {
  const busy = useCheckoutBusy();
  return (
    <button
      disabled={pending || !ready || busy}
      className="min-h-12 self-end rounded bg-orange-700 px-8 text-base font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
    >
      {pending ? "Placing order…" : "Place order"}
    </button>
  );
}
