"use client";

import { useActionState, useState } from "react";
import { decideApprovalAction } from "@/features/approvals/actions";
import { REASON_MAX } from "@/features/approvals/utils";
import type { ApprovalActionState } from "@/features/approvals/types";

// Approve, or reject with a reason the buyer will see. The flow's version makes a stale page fail safely
// (someone else decided meanwhile) instead of overriding that decision.
export function ApprovalDecisionForm({ flowId, version }: { flowId: string; version: number }) {
  const [state, action, pending] = useActionState(decideApprovalAction, {} as ApprovalActionState);
  const [rejecting, setRejecting] = useState(false);
  if (state.done) {
    return (
      <p role="status" className="m-0 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
        {state.done}
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="flowId" value={flowId} />
      <input type="hidden" name="version" value={version} />
      {rejecting && (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Reason for rejecting (the buyer sees it)
          <textarea
            name="reason"
            required
            maxLength={REASON_MAX}
            rows={3}
            autoFocus
            className="rounded border border-gray-300 p-3 font-normal"
            placeholder="e.g. Please split the order across two months."
          />
        </label>
      )}
      {state.error && (
        <p role="alert" className="m-0 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {rejecting ? (
          <>
            <button
              name="decision"
              value="reject"
              disabled={pending}
              className="min-h-11 rounded bg-red-700 px-5 font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Reject order"}
            </button>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              disabled={pending}
              className="min-h-11 rounded border border-gray-300 px-5 font-semibold"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              name="decision"
              value="approve"
              disabled={pending}
              className="min-h-11 rounded bg-orange-700 px-5 font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Approve order"}
            </button>
            <button
              type="button"
              onClick={() => setRejecting(true)}
              disabled={pending}
              className="min-h-11 rounded border border-gray-300 px-5 font-semibold"
            >
              Reject…
            </button>
          </>
        )}
      </div>
    </form>
  );
}

// A rejected order whose cancellation failed: repeat only the cancellation (the rejection already stands).
export function RetryCancelForm({ flowId, version }: { flowId: string; version: number }) {
  const [state, action, pending] = useActionState(decideApprovalAction, {} as ApprovalActionState);
  if (state.done) {
    return (
      <p role="status" className="m-0 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
        {state.done}
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="flowId" value={flowId} />
      <input type="hidden" name="version" value={version} />
      <p className="m-0 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        This order was rejected but is not cancelled yet, so it could still be processed.
      </p>
      {state.error && (
        <p role="alert" className="m-0 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {state.error}
        </p>
      )}
      <button
        name="decision"
        value="retry-cancel"
        disabled={pending}
        className="min-h-11 self-start rounded bg-red-700 px-5 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Cancelling…" : "Retry cancellation"}
      </button>
    </form>
  );
}
