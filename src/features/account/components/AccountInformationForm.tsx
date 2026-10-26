"use client";

import { useActionState } from "react";
import { updateAccountInformation } from "@/features/account/actions";
import type { AccountInfoState } from "@/features/account/types";
import { NAME_MAX } from "@/features/account/utils";

const initial: AccountInfoState = {};
const field = "min-h-11 w-full rounded border border-gray-300 px-3 text-base";

export function AccountInformationForm({ firstName, lastName, email }: { firstName: string; lastName: string; email: string }) {
  const [state, action, pending] = useActionState(updateAccountInformation, initial);
  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      {state.error && (
        <p role="alert" className="m-0 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p role="status" className="m-0 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          You saved the account information.
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm font-semibold">
        First name
        <input name="firstName" defaultValue={firstName} required maxLength={NAME_MAX} autoComplete="given-name" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Last name
        <input name="lastName" defaultValue={lastName} required maxLength={NAME_MAX} autoComplete="family-name" className={field} />
      </label>
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Email</span>
        <span className="text-gray-700">{email}</span>
        <span className="text-xs text-gray-600">Your sign-in email is managed by your company administrator.</span>
      </div>
      <button
        disabled={pending}
        className="min-h-11 self-start rounded bg-orange-700 px-6 font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
