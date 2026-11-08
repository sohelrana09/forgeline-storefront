"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/PageMessages";
import { stockAlertAction, type StockAlertState } from "@/features/stock-alerts/actions";

export function StockAlertForm({ sku, following }: { sku: string; following: boolean }) {
  const [state, action, pending] = useActionState(stockAlertAction, {} as StockAlertState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3 text-sm">
      <FormMessage state={state} error={state.error} success={state.saved} />
      <input type="hidden" name="sku" value={sku} />
      {following ? (
        <>
          <span className="text-gray-700">We&apos;ll email you once it&apos;s back.</span>
          <button name="intent" value="remove" disabled={pending} className="text-red-800 underline disabled:opacity-60">
            Stop
          </button>
        </>
      ) : (
        <button disabled={pending} className="min-h-11 rounded border border-gray-300 bg-white px-4 font-semibold disabled:opacity-60">
          {pending ? "Saving…" : "Email me when it's back"}
        </button>
      )}
    </form>
  );
}
