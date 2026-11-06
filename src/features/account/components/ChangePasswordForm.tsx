"use client";

import { useActionState } from "react";
import { changePassword } from "@/features/account/actions";
import type { ChangePasswordState } from "@/features/account/types";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/features/auth/utils";
import { FormMessage } from "@/components/ui/PageMessages";

const initial: ChangePasswordState = {};
const input = "min-h-11 w-full rounded border border-gray-300 px-3 text-base";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initial);
  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      <FormMessage state={state} error={state.error} success={state.saved ? "You changed your password." : undefined} />
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Current password
        <input name="currentPassword" type="password" required autoComplete="current-password" className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        New password
        <input
          name="newPassword"
          type="password"
          required
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          autoComplete="new-password"
          className={input}
        />
        <span className="text-xs font-normal text-gray-600">
          {PASSWORD_MIN} to {PASSWORD_MAX} characters, with a letter and a number.
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Confirm new password
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          autoComplete="new-password"
          className={input}
        />
      </label>
      <button
        disabled={pending}
        className="min-h-11 self-start rounded bg-orange-700 px-6 font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
