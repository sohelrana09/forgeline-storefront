"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/PageMessages";
import { requestQuote } from "@/features/quotes/actions";
import type { QuoteActionState } from "@/features/quotes/types";
import { COMMENT_MAX } from "@/features/quotes/utils";

// Sends the whole cart as a quote request. cartVersion = the version the buyer is looking at.
export function RequestQuoteForm({ cartVersion, primary }: { cartVersion: number; primary: boolean }) {
  const [state, action, pending] = useActionState(requestQuote, {} as QuoteActionState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="cartVersion" value={cartVersion} />
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Message for our sales team
        <textarea
          name="comment"
          required
          maxLength={COMMENT_MAX}
          rows={4}
          placeholder="Quantities, delivery date, site details, payment terms…"
          className="rounded border border-gray-300 p-2.5 font-normal"
        />
      </label>
      <FormMessage state={state} error={state.error} />
      <button
        disabled={pending}
        className={`min-h-11 rounded px-5 font-semibold disabled:opacity-60 ${
          primary ? "bg-orange-700 text-white hover:bg-orange-800" : "border border-orange-700 bg-white text-orange-800 hover:bg-orange-50"
        }`}
      >
        {pending ? "Sending…" : "Request a quote"}
      </button>
    </form>
  );
}
