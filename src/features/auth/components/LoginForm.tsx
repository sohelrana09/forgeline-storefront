"use client";

import { useActionState } from "react";
import { login } from "@/features/auth/actions";
import type { LoginState } from "@/features/auth/types";
import { FormGuardFields } from "@/components/ui/FormGuardFields";
import { FormMessage } from "@/components/ui/PageMessages";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, {} as LoginState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormGuardFields />
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.email}
          className="min-h-11 rounded border border-gray-300 px-3 font-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-11 rounded border border-gray-300 px-3 font-normal"
        />
      </label>
      <FormMessage state={state} error={state.error} />
      <button disabled={pending} className="min-h-11 rounded bg-orange-700 px-4 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
