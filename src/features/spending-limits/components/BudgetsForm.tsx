"use client";

import { useActionState } from "react";
import { saveBudgetsAction, type BudgetFormState } from "@/features/spending-limits/actions";
import { FormMessage } from "@/components/ui/PageMessages";
import type { BudgetRule } from "@/features/spending-limits/budget";

export type BudgetRow = { id: string; label: string; rule?: BudgetRule; amount: string; spent?: string };

const field = "min-h-11 rounded border border-gray-300 px-3";

// One row per budget: amount (empty = none), period, and what happens to an order over it.
function Row({ prefix, row, currency }: { prefix: string; row: BudgetRow; currency: string }) {
  return (
    <tr className="border-t border-gray-200 align-top">
      <th scope="row" className="py-2 pr-3 text-left font-semibold">
        {row.label}
        {row.spent && <span className="block text-xs font-normal text-gray-600">Spent this period: {row.spent}</span>}
      </th>
      <td className="py-2 pr-3">
        <input
          name={`${prefix}.amount`}
          inputMode="decimal"
          defaultValue={row.amount}
          aria-label={`${row.label}: budget in ${currency}, empty for none`}
          placeholder="No budget"
          className={`${field} w-36`}
        />
      </td>
      <td className="py-2 pr-3">
        <select
          name={`${prefix}.period`}
          defaultValue={row.rule?.period ?? "monthly"}
          aria-label={`${row.label}: period`}
          className={field}
        >
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
        </select>
      </td>
      <td className="py-2">
        <select name={`${prefix}.mode`} defaultValue={row.rule?.mode ?? "block"} aria-label={`${row.label}: over budget`} className={field}>
          <option value="block">Block the order</option>
          <option value="warn">Allow with a warning</option>
        </select>
      </td>
    </tr>
  );
}

export function BudgetsForm({ currency, unit, buyers }: { currency: string; unit: BudgetRow; buyers: BudgetRow[] }) {
  const [state, action, pending] = useActionState(saveBudgetsAction, {} as BudgetFormState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage state={state} error={state.error} success={state.saved} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="pb-2 text-left text-gray-700">Net amounts in {currency}. Leave the amount empty for no budget.</caption>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
              <th scope="col" className="pb-2">
                Who
              </th>
              <th scope="col" className="pb-2">
                Budget
              </th>
              <th scope="col" className="pb-2">
                Period
              </th>
              <th scope="col" className="pb-2">
                Over budget
              </th>
            </tr>
          </thead>
          <tbody>
            <Row prefix="unit" row={unit} currency={currency} />
            {buyers.map((b) => (
              <Row key={b.id} prefix={b.id} row={b} currency={currency} />
            ))}
          </tbody>
        </table>
      </div>
      {buyers.map((b) => (
        <input key={b.id} type="hidden" name="buyer" value={b.id} />
      ))}
      <button
        disabled={pending}
        className="min-h-11 self-start rounded bg-orange-700 px-6 font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save budgets"}
      </button>
    </form>
  );
}
