"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage } from "@/components/ui/PageMessages";
import { saveApprovalRuleAction } from "@/features/company/actions";
import type { ApprovalRuleSummary, CompanyActionState } from "@/features/company/types";

type RoleOption = { key: string; name: string; canApprove: boolean };

// Create or edit an approval rule: name, "order total above" amount in the unit's currency, whose orders it
// applies to, and which roles may approve (any one of them). Switching "Active" off disables the rule.
export function ApprovalRuleForm({ rule, roles, currency }: { rule?: ApprovalRuleSummary; roles: RoleOption[]; currency: string }) {
  const [state, action, pending] = useActionState(saveApprovalRuleAction, {} as CompanyActionState);
  const requesters = rule?.requesters ?? ["buyer"];
  const approvers = rule?.approvers ?? roles.filter((r) => r.canApprove).map((r) => r.key);
  return (
    <form action={action} className="flex flex-col gap-5 rounded-md border border-gray-200 bg-white p-5">
      {rule && (
        <>
          <input type="hidden" name="id" value={rule.id} />
          <input type="hidden" name="version" value={rule.version} />
        </>
      )}
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Rule name
        <input
          name="name"
          required
          minLength={3}
          maxLength={100}
          defaultValue={rule?.name}
          placeholder="e.g. Orders over €10,000"
          className="min-h-11 rounded border border-gray-300 px-3 font-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Description (optional)
        <textarea
          name="description"
          maxLength={500}
          rows={2}
          defaultValue={rule?.description}
          className="rounded border border-gray-300 p-3 font-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Needs approval when the order total is above ({currency})
        <input
          name="amount"
          required
          inputMode="numeric"
          pattern="[0-9 ,]+"
          defaultValue={rule?.amount}
          placeholder="10000"
          className="min-h-11 rounded border border-gray-300 px-3 font-normal sm:max-w-xs"
        />
        <span className="text-xs font-normal text-gray-600">
          The order total as the buyer sees it, including VAT where prices include it.
        </span>
      </label>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-sm font-semibold">Applies to orders placed by</legend>
        {roles.map((r) => (
          <label key={r.key} className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="requesters" value={r.key} defaultChecked={requesters.includes(r.key)} />
            {r.name}
          </label>
        ))}
      </fieldset>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-sm font-semibold">Can be approved by (any one of)</legend>
        {roles
          .filter((r) => r.canApprove)
          .map((r) => (
            <label key={r.key} className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" name="approvers" value={r.key} defaultChecked={approvers.includes(r.key)} />
              {r.name}
            </label>
          ))}
      </fieldset>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
        <input type="checkbox" name="active" defaultChecked={rule?.active ?? true} />
        Active (switch off to stop requiring approval; rules can&apos;t be deleted)
      </label>
      <FormMessage state={state} error={state.error} />
      <div className="flex flex-wrap gap-3">
        <button
          disabled={pending}
          className="min-h-11 rounded bg-orange-700 px-6 font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save rule"}
        </button>
        <Link
          href="/account/company/approval-rules"
          className="flex min-h-11 items-center rounded border border-gray-300 px-5 font-semibold text-gray-800 no-underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
