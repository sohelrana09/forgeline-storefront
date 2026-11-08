"use client";

import { useActionState } from "react";
import { changeRecurringOrderAction, createRecurringOrderAction, type RecurringFormState } from "@/features/recurring-orders/actions";
import { FormMessage } from "@/components/ui/PageMessages";
import type { RecurringOp } from "@/features/recurring-orders/schedule";

const field = "min-h-11 rounded border border-gray-300 px-3 font-normal";

// "Repeat this order" on an order or a purchase list: how often, and the first order's day.
export function CreateRecurringForm({
  sourceKind,
  sourceId,
  listScope,
  policies,
  min,
  max,
}: {
  sourceKind: "order" | "list";
  sourceId: string;
  listScope?: "mine" | "company";
  policies: { key: string; label: string }[];
  min: string;
  max: string;
}) {
  const [state, action, pending] = useActionState(createRecurringOrderAction, {} as RecurringFormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="sourceKind" value={sourceKind} />
      <input type="hidden" name="sourceId" value={sourceId} />
      {listScope && <input type="hidden" name="listScope" value={listScope} />}
      <label className="flex flex-col gap-1 text-sm font-semibold">
        How often
        <select name="policy" required className={field}>
          {policies.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        First order on
        <input type="date" name="startsAt" required min={min} max={max} defaultValue={min} className={field} />
      </label>
      <button
        disabled={pending}
        className="min-h-11 rounded border border-orange-700 px-4 font-semibold text-orange-800 hover:bg-orange-50 disabled:opacity-60"
      >
        {pending ? "Setting up…" : "Set up recurring order"}
      </button>
      <FormMessage state={state} error={state.error} />
    </form>
  );
}

const LABEL: Record<RecurringOp, string> = { pause: "Pause", resume: "Resume", skip: "Skip next order", cancel: "Cancel" };

export function RecurringOrderButtons({ id, ops }: { id: string; ops: RecurringOp[] }) {
  const [state, action, pending] = useActionState(changeRecurringOrderAction, {} as RecurringFormState);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const op = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
        if (op === "cancel" && !window.confirm("Cancel this recurring order? No further orders will be placed.")) e.preventDefault();
      }}
      className="flex flex-wrap gap-2"
    >
      <input type="hidden" name="id" value={id} />
      {ops.map((op) => (
        <button
          key={op}
          name="op"
          value={op}
          disabled={pending}
          className={`min-h-11 rounded border px-4 text-sm font-semibold disabled:opacity-60 ${
            op === "cancel" ? "border-red-700 text-red-800 hover:bg-red-50" : "border-gray-300 text-gray-800 hover:bg-gray-50"
          }`}
        >
          {LABEL[op]}
        </button>
      ))}
      <FormMessage state={state} error={state.error} success={state.saved} />
    </form>
  );
}
