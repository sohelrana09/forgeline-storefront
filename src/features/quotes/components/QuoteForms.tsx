"use client";

import { useActionState } from "react";
import { acceptAndOrder, cancelRequest, decline, renegotiate } from "@/features/quotes/actions";
import type { QuoteActionState } from "@/features/quotes/types";
import { COMMENT_MAX } from "@/features/quotes/utils";

const initial: QuoteActionState = {};

function ErrorNote({ error }: { error?: string }) {
  return error ? (
    <p role="alert" className="m-0 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      {error}
    </p>
  ) : null;
}

export function CancelRequestForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(cancelRequest, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <ErrorNote error={state.error} />
      <button disabled={pending} className="min-h-11 rounded border border-gray-300 bg-white px-5 font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60">
        {pending ? "Cancelling…" : "Cancel request"}
      </button>
    </form>
  );
}

// The three decisions on a Pending quote. `version` is the quote the buyer is looking at: if it changed meanwhile,
// the service refuses instead of acting on something they haven't seen.
export function QuoteDecisionForms({ id, version }: { id: string; version: number }) {
  const [orderState, orderAction, ordering] = useActionState(acceptAndOrder, initial);
  const [declineState, declineAction, declining] = useActionState(decline, initial);
  const [renegotiateState, renegotiateAction, renegotiating] = useActionState(renegotiate, initial);
  const busy = ordering || declining || renegotiating;

  return (
    <div className="flex flex-col gap-4">
      <form action={orderAction} className="flex flex-col gap-3 rounded-md border border-green-200 bg-green-50 p-4">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="version" value={version} />
        <h2 className="m-0 text-lg font-semibold text-green-950">Accept and place order</h2>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Purchase order number (optional)
          <input name="purchaseOrderNumber" maxLength={35} placeholder="e.g. PO-4711" className="min-h-11 rounded border border-gray-300 bg-white px-3 font-normal" />
        </label>
        <ErrorNote error={orderState.error} />
        <button disabled={busy} className="min-h-12 rounded bg-orange-700 px-5 font-semibold text-white hover:bg-orange-800 disabled:opacity-60">
          {ordering ? "Placing order…" : "Accept quote and place order"}
        </button>
      </form>

      <details className="rounded-md border border-gray-200 bg-white p-4">
        <summary className="font-semibold">Ask for changes</summary>
        <form action={renegotiateAction} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="version" value={version} />
          <label className="flex flex-col gap-1 text-sm font-semibold">
            What should change?
            <textarea name="comment" required maxLength={COMMENT_MAX} rows={3} className="rounded border border-gray-300 p-2.5 font-normal" />
          </label>
          <ErrorNote error={renegotiateState.error} />
          <button disabled={busy} className="min-h-11 rounded border border-orange-700 bg-white px-5 font-semibold text-orange-800 hover:bg-orange-50 disabled:opacity-60">
            {renegotiating ? "Sending…" : "Request changes"}
          </button>
        </form>
      </details>

      <form action={declineAction} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="version" value={version} />
        <ErrorNote error={declineState.error} />
        <button disabled={busy} className="min-h-11 rounded px-5 text-sm font-semibold text-red-800 underline underline-offset-2 disabled:opacity-60">
          {declining ? "Declining…" : "Decline quote"}
        </button>
      </form>
    </div>
  );
}
