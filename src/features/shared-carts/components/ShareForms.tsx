"use client";

import { useActionState } from "react";
import {
  declineSharedCartAction,
  shareCartAction,
  takeOverSharedCartAction,
  withdrawShareAction,
  type ShareState,
} from "@/features/shared-carts/actions";
import { FormMessage } from "@/components/ui/PageMessages";
import { SHARE_NOTE_MAX } from "@/features/shared-carts/share";

const field = "min-h-11 rounded border border-gray-300 px-3 font-normal";
const secondary = "min-h-11 rounded border border-gray-300 px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60";

export function ShareCartForm({ reviewers }: { reviewers: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(shareCartAction, {} as ShareState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Colleague
        <select name="reviewerId" required className={field}>
          {reviewers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Note (optional)
        <textarea name="note" rows={2} maxLength={SHARE_NOTE_MAX} className="rounded border border-gray-300 px-3 py-2 font-normal" />
      </label>
      <button disabled={pending} className={`${secondary} self-start`}>
        {pending ? "Sending…" : "Send for review"}
      </button>
      <FormMessage state={state} error={state.error} success={state.saved} />
    </form>
  );
}

export function WithdrawShareButton() {
  const [state, action, pending] = useActionState(withdrawShareAction, {} as ShareState);
  return (
    <form action={action}>
      <button disabled={pending} className={secondary}>
        {pending ? "Withdrawing…" : "Withdraw"}
      </button>
      <FormMessage state={state} error={state.error} success={state.saved} />
    </form>
  );
}

export function ReviewButtons({ cartId, from }: { cartId: string; from: string }) {
  const [takeState, take, taking] = useActionState(takeOverSharedCartAction, {} as ShareState);
  const [declineState, decline, declining] = useActionState(declineSharedCartAction, {} as ShareState);
  return (
    <div className="flex flex-col gap-3">
      <form action={take}>
        <input type="hidden" name="cartId" value={cartId} />
        <button
          disabled={taking}
          className="min-h-11 rounded bg-orange-700 px-5 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
        >
          {taking ? "Taking over…" : "Take over to edit and order"}
        </button>
      </form>
      <details>
        <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">Send it back to {from}</summary>
        <form action={decline} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="cartId" value={cartId} />
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Reason (optional, {from} sees it)
            <textarea name="reason" rows={2} maxLength={SHARE_NOTE_MAX} className="rounded border border-gray-300 px-3 py-2 font-normal" />
          </label>
          <button disabled={declining} className={`${secondary} self-start`}>
            {declining ? "Sending back…" : "Send back"}
          </button>
        </form>
      </details>
      <FormMessage state={takeState} error={takeState.error} />
      <FormMessage state={declineState} error={declineState.error} success={declineState.saved} />
    </div>
  );
}
