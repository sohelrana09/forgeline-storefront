"use client";

import { useActionState } from "react";
import { login } from "@/features/auth/actions";
import type { LoginState } from "@/features/auth/types";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, {} as LoginState);
  return (
    <form action={action} className="flex flex-col gap-4">
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
      {state.error && (
        <p role="alert" className="m-0 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="min-h-11 rounded bg-orange-700 px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
