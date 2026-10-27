"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/PageMessages";
import type { BaseAddress } from "@commercetools/platform-sdk";
import { deleteAddress, saveAddress } from "@/features/account/actions";
import type { AddressFormState } from "@/features/account/types";

const initial: AddressFormState = {};
const input = "min-h-11 w-full rounded border border-gray-300 px-3 text-base font-normal";
const label = "flex flex-col gap-1 text-sm font-semibold";

// Add (no address) or edit (address with id) one address of the customer's own address book.
export function AddressForm({
  address,
  countries,
  isDefaultShipping = false,
  isDefaultBilling = false,
}: {
  address?: BaseAddress;
  countries: { code: string; name: string }[];
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
}) {
  const [state, action, pending] = useActionState(saveAddress, initial);
  const id = address?.id ?? "new";
  return (
    <form action={action} className="flex flex-col gap-4">
      {address?.id && <input type="hidden" name="id" value={address.id} />}
      <FormMessage state={state} error={state.error} success={state.saved ? "You saved the address." : undefined} />
      <AddressFields address={address} countries={countries} />
      <div className="flex flex-wrap gap-x-6">
        <label htmlFor={`ship-${id}`} className="flex min-h-11 items-center gap-2 text-sm">
          <input id={`ship-${id}`} type="checkbox" name="defaultShipping" defaultChecked={isDefaultShipping} className="h-5 w-5" />
          Use as my default shipping address
        </label>
        <label htmlFor={`bill-${id}`} className="flex min-h-11 items-center gap-2 text-sm">
          <input id={`bill-${id}`} type="checkbox" name="defaultBilling" defaultChecked={isDefaultBilling} className="h-5 w-5" />
          Use as my default billing address
        </label>
      </div>
      <button
        disabled={pending}
        className="min-h-11 self-start rounded bg-orange-700 px-6 font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save address"}
      </button>
    </form>
  );
}

export function DeleteAddressButton({ id, label }: { id: string; label: string }) {
  return (
    <form
      action={deleteAddress}
      onSubmit={(e) => {
        if (!window.confirm(`Delete this address?\n${label}`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="min-h-11 px-1 text-sm text-red-800 underline underline-offset-2">Delete</button>
    </form>
  );
}

// The address inputs, shared by the address book and guest checkout (same names as parseAddress reads).
export function AddressFields({ address, countries }: { address?: BaseAddress; countries: { code: string; name: string }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={label}>
        First name
        <input name="firstName" required maxLength={60} defaultValue={address?.firstName} autoComplete="given-name" className={input} />
      </label>
      <label className={label}>
        Last name
        <input name="lastName" required maxLength={60} defaultValue={address?.lastName} autoComplete="family-name" className={input} />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Company (optional)
        <input name="company" maxLength={100} defaultValue={address?.company} autoComplete="organization" className={input} />
      </label>
      <label className={label}>
        Street
        <input
          name="streetName"
          required
          maxLength={100}
          defaultValue={address?.streetName}
          autoComplete="address-line1"
          className={input}
        />
      </label>
      <label className={label}>
        Number
        <input name="streetNumber" maxLength={20} defaultValue={address?.streetNumber} className={input} />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Apartment, floor (optional)
        <input
          name="additionalStreetInfo"
          maxLength={100}
          defaultValue={address?.additionalStreetInfo}
          autoComplete="address-line2"
          className={input}
        />
      </label>
      <label className={label}>
        Postcode
        <input name="postalCode" required maxLength={12} defaultValue={address?.postalCode} autoComplete="postal-code" className={input} />
      </label>
      <label className={label}>
        City
        <input name="city" required maxLength={60} defaultValue={address?.city} autoComplete="address-level2" className={input} />
      </label>
      <label className={label}>
        Country
        <select
          name="country"
          required
          defaultValue={address?.country ?? countries[0]?.code}
          autoComplete="country"
          className={`${input} bg-white`}
        >
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Phone (optional)
        <input name="phone" type="tel" maxLength={30} defaultValue={address?.phone} autoComplete="tel" className={input} />
      </label>
    </div>
  );
}
