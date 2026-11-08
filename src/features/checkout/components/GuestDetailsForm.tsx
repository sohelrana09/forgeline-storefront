"use client";

import { useActionState, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { BaseAddress } from "@commercetools/platform-sdk";
import { saveGuestDetails, type GuestDetailsState } from "@/features/checkout/actions";
import { AddressFields } from "@/features/account/components/AddressForm";
import { CheckoutStep } from "@/features/checkout/components/CheckoutStep";
import { keepFields, MethodTable } from "@/features/checkout/components/CheckoutForm";
import { useReportBusy } from "@/features/checkout/components/CheckoutStatus";
import type { MethodOption } from "@/features/checkout/utils";
import { FormMessage } from "@/components/ui/PageMessages";
import { FormGuardFields } from "@/components/ui/FormGuardFields";

export type CountryMethods = Record<string, { methods: MethodOption[]; defaultKey?: string }>;

// Wait after the last keystroke (autofill fills many fields without leaving any) and after a click or a field is left.
const TYPING_MS = 1200;
const CHOICE_MS = 200;
// The server refuses guest forms sent sooner than 1.5 s after they rendered (bot check, src/lib/bot-check.ts).
const MIN_OPEN_MS = 1600;

// Guest checkout steps 1 and 2: email and shipping address (also used for billing), then the shipping method. Saved on
// the guest's cart in the background as soon as the form is complete, and again after each change, so the totals and
// the payment step follow without a save button. Rates for every country come with the page: changing the country
// shows its methods at once, with that country's default chosen.
export function GuestDetailsForm({
  email,
  address,
  countries,
  methodsByCountry,
  methodKey,
  saved,
}: {
  email?: string;
  address?: BaseAddress;
  countries: { code: string; name: string }[];
  methodsByCountry: CountryMethods;
  methodKey?: string;
  // The cart already has these details (email, address, method).
  saved: boolean;
}) {
  const [state, action, pending] = useActionState(saveGuestDetails, {} as GuestDetailsState);
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<number | undefined>(undefined);
  // Timers read these (always current): changes made, changes sent with the last save, a save running, form age.
  const editsRef = useRef(0);
  const sentRef = useRef(0);
  const pendingRef = useRef(false);
  const openLongEnough = useRef(false);
  // The same for rendering: unsaved while the changes made differ from those the server confirmed.
  const [edits, setEdits] = useState(0);
  const [sent, setSent] = useState(0);
  const [confirmed, setConfirmed] = useState(0);
  const dirty = edits !== confirmed;
  // Every required field is filled in and valid (checked on each change), so a save is on its way.
  const [complete, setComplete] = useState(true);
  const [country, setCountry] = useState(address?.country ?? countries[0]?.code ?? "");
  const offered = methodsByCountry[country] ?? { methods: [] };
  const [chosen, setChosen] = useState(methodKey ?? offered.defaultKey);
  const method = offered.methods.some((m) => m.key === chosen) ? chosen : offered.defaultKey;

  // Sends the form when it is complete and nothing is being saved; otherwise the next change or save tries again.
  const save = useCallback(() => {
    const el = form.current;
    // Too soon after the page opened: the timer below sends it once the form is old enough.
    if (!el || !openLongEnough.current || pendingRef.current || editsRef.current === sentRef.current || !el.checkValidity()) return;
    sentRef.current = editsRef.current;
    setSent(sentRef.current);
    el.requestSubmit();
  }, []);
  const schedule = useCallback(
    (ms: number) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(save, ms);
    },
    [save],
  );

  useEffect(() => {
    const opened = window.setTimeout(() => {
      openLongEnough.current = true;
      save();
    }, MIN_OPEN_MS);
    return () => {
      window.clearTimeout(opened);
      window.clearTimeout(timer.current);
    };
  }, [save]);

  // A save finished: what it sent is saved (unless it failed); edits made meanwhile are sent next.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (!state.error) setConfirmed(sent);
  }
  useEffect(() => {
    pendingRef.current = pending;
    if (!pending) schedule(CHOICE_MS);
  }, [pending, schedule]);

  const onChange = (e: FormEvent<HTMLFormElement>) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement; // the field that changed
    editsRef.current += 1;
    setEdits(editsRef.current);
    setComplete(e.currentTarget.checkValidity());
    if (target.name === "country") setCountry(target.value);
    if (target.name === "shippingMethodKey") setChosen(target.value);
    schedule(target.tagName === "SELECT" || target.type === "radio" ? CHOICE_MS : TYPING_MS);
  };

  // Place order waits while a change is unsaved or saving.
  useReportBusy("guest-details", pending || dirty);
  const status =
    pending || (dirty && complete && !state.error)
      ? "Saving your details and updating the total…"
      : state.error
        ? ""
        : dirty
          ? "Complete the required fields to update your order."
          : saved
            ? "Saved. Your total and payment options are up to date."
            : "";

  return (
    <form
      ref={form}
      action={action}
      onSubmit={keepFields(action)}
      onChange={onChange}
      onBlur={() => schedule(CHOICE_MS)}
      className="flex flex-col gap-6"
    >
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
        {/* Remounted per country: its methods and default differ. */}
        <MethodTable key={country} methods={offered.methods} methodKey={method} required />
        <p role="status" className="m-0 min-h-5 text-sm text-gray-600">
          {status}
        </p>
        <FormMessage state={state} error={state.error} />
        <noscript>
          <button className="min-h-11 rounded bg-gray-900 px-6 font-semibold text-white">Save shipping details</button>
        </noscript>
      </CheckoutStep>
    </form>
  );
}
