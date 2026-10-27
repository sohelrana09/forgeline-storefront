import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { StateBadge } from "@/components/ui/StateBadge";
import { CompanyError, getRoles } from "@/features/company/service";
import { listApprovalRules } from "@/features/company/approval-rules";
import { can, roleLabel } from "@/features/company/utils";
import type { Session } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";
import { Message } from "@/components/ui/Message";

const STATUS = {
  Active: { label: "Active", tone: "success" as const },
  Inactive: { label: "Inactive", tone: "neutral" as const },
};

// Approval rules: what needs approval in the selected unit, whose orders, and who approves.
export async function ApprovalRulesView({ session, context, saved }: { session: Session; context: BuyerContext; saved: boolean }) {
  const [list, roles] = await Promise.all([
    listApprovalRules(context, session.customerId).catch((err) => {
      if (err instanceof CompanyError) redirect("/account");
      throw err;
    }),
    getRoles(),
  ]);
  const names = (keys: string[]) => keys.map((k) => roleLabel(k, roles)).join(" or ");
  const canCreate = can(context, "CreateApprovalRules");
  const canEdit = can(context, "UpdateApprovalRules");

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs items={[{ label: "My account", href: "/account" }, { label: "Approval rules" }]} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-bold">Approval rules</h1>
          <p className="m-0 mt-1 text-sm text-gray-600">
            Orders for {context.businessUnitName} that match an active rule wait for approval before they are processed.
            {context.unitType === "Division" && " Rules of the parent company apply here too."}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/account/company/approval-rules/new"
            className="rounded bg-orange-700 px-5 py-3 font-semibold text-white no-underline hover:bg-orange-800"
          >
            Add new rule
          </Link>
        )}
      </div>
      {saved && <Message type="success">You saved the approval rule.</Message>}
      <section aria-label="Approval rules" className="rounded-md border border-gray-200 bg-white">
        {list.length === 0 ? (
          <p className="m-0 p-5 text-sm text-gray-600">No approval rules yet: every order is processed right away.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
                  <th className="px-5 py-2.5 font-semibold">Rule</th>
                  <th className="px-3 py-2.5 font-semibold">Condition</th>
                  <th className="px-3 py-2.5 font-semibold">Applies to</th>
                  <th className="px-3 py-2.5 font-semibold">Approved by</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 align-top">
                    <td className="px-5 py-3">
                      <div className="font-semibold">{r.name}</div>
                      {r.description && <div className="text-xs text-gray-600">{r.description}</div>}
                    </td>
                    <td className="px-3 py-3">{r.condition}</td>
                    <td className="px-3 py-3">{names(r.requesters)}</td>
                    <td className="px-3 py-3">
                      {names(r.approvers)}
                      {r.steps > 1 && <span className="block text-xs text-gray-600">{r.steps} approval steps</span>}
                    </td>
                    <td className="px-3 py-3">
                      <StateBadge state={r.active ? "Active" : "Inactive"} map={STATUS} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      {/* The form edits "order total above" rules with one approval step; others are read-only here. */}
                      {canEdit && r.amount !== undefined && r.steps === 1 && (
                        <Link href={`/account/company/approval-rules/${r.id}`} className="text-orange-800" aria-label={`Edit ${r.name}`}>
                          Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
