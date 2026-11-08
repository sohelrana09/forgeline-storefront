"use client";

import { useActionState } from "react";
import { signInAsDemo } from "@/features/auth/actions";
import type { LoginState } from "@/features/auth/types";
import { DEMO_LABELS, DEMO_ROLES } from "@/features/demo/demo";
import { FormMessage } from "@/components/ui/PageMessages";

// "Try as Buyer / Approver / Admin" (DEMO_MODE): one form, one button per persona. Only the role is sent; the server
// holds the password.
export function DemoSwitcher() {
  const [state, action, pending] = useActionState(signInAsDemo, {} as LoginState);
  return (
    <section
      id="demo"
      aria-labelledby="demo-heading"
      className="mb-6 flex flex-col gap-3 rounded-md border border-orange-200 bg-orange-50 p-4"
    >
      <div>
        <h2 id="demo-heading" className="m-0 text-lg font-semibold text-gray-900">
          Try the demo company
        </h2>
        <p className="m-0 mt-1 text-sm text-gray-700">
          Sign in as one of LiftTech&apos;s people, no account needed. Everyone shares these accounts, and their carts, quotes and approvals
          reset every night.
        </p>
      </div>
      <form action={action} className="grid gap-2 sm:grid-cols-3">
        {DEMO_ROLES.map((role) => (
          <button
            key={role}
            name="role"
            value={role}
            disabled={pending}
            className="flex min-h-11 flex-col items-start rounded border border-gray-900 bg-white px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            <span className="font-semibold text-gray-900">Try as {DEMO_LABELS[role].label}</span>
            <span className="text-xs text-gray-600">{DEMO_LABELS[role].blurb}</span>
          </button>
        ))}
      </form>
      <FormMessage state={state} error={state.error} />
    </section>
  );
}
