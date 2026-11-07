"use client";

import { useActionState, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { BaseAddress } from "@commercetools/platform-sdk";
import { saveBillingAddress, type BillingState } from "@/features/checkout/actions";
import { AddressFields } from "@/features/account/components/AddressForm";
import { keepFields } from "@/features/checkout/components/CheckoutForm";
import { useReportBusy } from "@/features/checkout/components/CheckoutStatus";
import { FormMessage } from "@/components/ui/PageMessages";
import { FormGuardFields } from "@/components/ui/FormGuardFields";

// The payment step's one billing address, shared by every payment method (Magento's "Display Billing Address On:
// Payment Page"). Ticked, the cart is billed at the shipping address; unticked, the buyer picks a saved address
// (consumers) or enters a new one and saves it with Update. Paying waits while a change is unsaved. Locked while a
// payment is open: the cart can't change then.
export function BillingAddress({
  same,
  billingLabel,
  billing,
  saved,
  savedId,
  countries,
  locked,
}: {
  // The cart is billed at its shipping address.
  same: boolean;
  // The cart's billing address as lines, for the summary.
  billingLabel?: string;
  billing?: BaseAddress;
  // The consumer's saved addresses (none for guests).
  saved: { key: string; label: string }[];
  // The saved address the cart is billed at, if it is one.
  savedId?: string;
  countries: { code: string; name: string }[];
  locked: boolean;
}) {
  const [state, action, pending] = useActionState(saveBillingAddress, {} as BillingState);
  const form = useRef<HTMLFormElement>(null);
  const [checked, setChecked] = useState(same);
  const [choice, setChoice] = useState(savedId ? `saved:${savedId}` : saved.length > 0 && !billing ? `saved:${saved[0].key}` : "new");
  // Unticked and not saved yet: the order must not go out with the old billing address.
  const [editing, setEditing] = useState(false);
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state.saved) setEditing(false);
  }
  useReportBusy("billing", pending || editing);

  // A real submit (not FormData built here): FormGuardFields stamps the time on the submit event, and without it the
  // server refuses the request as automated. flushSync first, so the form already carries billing=same.
  const sameAgain = () => {
    flushSync(() => {
      setChecked(true);
      setEditing(false);
    });
    if (!same) form.current?.requestSubmit();
  };

  return (
    <form ref={form} action={action} onSubmit={keepFields(action)} className="flex flex-col gap-3 text-sm">
      <FormGuardFields />
      {checked && <input type="hidden" name="billing" value="same" />}
      <p className="m-0 font-semibold">Billing address</p>
      <label className={`flex items-center gap-2 ${locked ? "" : "cursor-pointer"}`}>
        <input
          type="checkbox"
          checked={checked}
          disabled={locked || pending}
          onChange={(e) => (e.target.checked ? sameAgain() : (setChecked(false), setEditing(true)))}
          className="size-4 accent-orange-700"
        />
        My billing and shipping address are the same
      </label>
      {(checked || !editing) && billingLabel && <p className="m-0 whitespace-pre-line text-gray-700">{billingLabel}</p>}
      {!checked && editing && (
        <div className="flex flex-col gap-3">
          <input type="hidden" name="billing" value={choice} />
          {saved.length > 0 && (
            <label className="flex flex-col gap-1 font-semibold">
              Bill to
              <select
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                className="min-h-11 rounded border border-gray-300 px-3 text-base font-normal"
              >
                {saved.map((a) => (
                  <option key={a.key} value={`saved:${a.key}`}>
                    {a.label.replaceAll("\n", ", ")}
                  </option>
                ))}
                <option value="new">New address</option>
              </select>
            </label>
          )}
          {choice === "new" && (
            <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
              <legend className="sr-only">Bill to</legend>
              <AddressFields address={savedId ? undefined : billing} countries={countries} />
            </fieldset>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={pending}
              className="min-h-11 rounded bg-gray-900 px-6 font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Update"}
            </button>
            <button
              type="button"
              onClick={() => {
                setChecked(same);
                setEditing(false);
              }}
              className="min-h-11 px-1 font-semibold text-gray-700 underline underline-offset-2 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {!checked && !editing && !locked && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-11 self-start px-1 font-semibold text-orange-800 underline underline-offset-2"
        >
          Change billing address
        </button>
      )}
      <FormMessage state={state} error={state.error} success={state.saved ? "Billing address saved." : undefined} />
    </form>
  );
}
