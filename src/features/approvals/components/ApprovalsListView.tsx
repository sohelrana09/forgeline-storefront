import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/utils";
import { StateBadge } from "@/components/ui/StateBadge";
import { ListToolbar } from "@/components/ui/ListToolbar";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ApprovalError, pageApprovals } from "@/features/approvals/service";
import { APPROVAL_STATES } from "@/features/approvals/utils";
import { getCompanyMembers } from "@/features/company/service";
import { orderReference } from "@/features/orders/service";
import type { Session } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB");

// Order approvals: orders of the selected unit that matched an approval rule. Pending first (the
// default tab); "All" includes approved and rejected ones. For associates with UpdateApprovalFlows (checked live).
export async function ApprovalsListView({
  session,
  context,
  view,
  page,
  size,
}: {
  session: Session;
  context: BuyerContext;
  view: "pending" | "all";
  page: number;
  size: number;
}) {
  const result = await pageApprovals(context, session.customerId, view, page, size).catch((err) => {
    if (err instanceof ApprovalError) redirect("/account");
    throw err;
  });
  const members = await getCompanyMembers(context, session.customerId).catch(() => []);
  const nameOf = (id?: string) => (id === session.customerId ? "You" : (members.find((m) => m.customerId === id)?.name ?? "Former user"));
  const hrefFor = (p: number, s: number) =>
    `/account/approvals?${new URLSearchParams({ ...(view === "all" && { view: "all" }), ...(p > 1 && { page: String(p) }), ...(s !== 10 && { limit: String(s) }) })}`;

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs items={[{ label: "My account", href: "/account" }, { label: "Order approvals" }]} />
      <div>
        <h1 className="m-0 text-2xl font-bold">Order approvals</h1>
        <p className="m-0 mt-1 text-sm text-gray-600">
          Orders for {context.businessUnitName} that need approval under your company&apos;s approval rules.
        </p>
      </div>
      <nav aria-label="Which approvals" className="flex gap-2">
        {[
          { href: "/account/approvals", label: "Waiting for approval", active: view === "pending" },
          { href: "/account/approvals?view=all", label: "All", active: view === "all" },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-full border px-4 text-sm no-underline ${
              t.active ? "border-gray-900 bg-gray-900 font-semibold text-white" : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <section aria-label="Approvals" className="rounded-md border border-gray-200 bg-white">
        {result.total === 0 ? (
          <p className="m-0 p-5 text-sm text-gray-600">
            {view === "pending" ? "No orders are waiting for approval." : "No orders have needed approval yet."}
          </p>
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
                    <th className="px-5 py-2.5 font-semibold">Order #</th>
                    <th className="px-3 py-2.5 font-semibold">Date</th>
                    <th className="px-3 py-2.5 font-semibold">Requested by</th>
                    <th className="px-3 py-2.5 font-semibold">Rule</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Order total</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-5 py-2.5 font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map(({ approval, order }) => (
                    <tr key={approval.flowId} className="border-t border-gray-100">
                      <td className="px-5 py-3 font-mono">{orderReference(order)}</td>
                      <td className="px-3 py-3">{date(order.createdAt)}</td>
                      <td className="px-3 py-3">{nameOf(order.customerId)}</td>
                      <td className="px-3 py-3">{approval.rules.join(", ")}</td>
                      <td className="px-3 py-3 text-right font-semibold">
                        {formatMoney(order.taxedPrice?.totalGross ?? order.totalPrice)}
                      </td>
                      <td className="px-3 py-3">
                        {order.orderState === "Cancelled" && approval.status === "Pending" ? (
                          <StateBadge state="Cancelled" map={{ Cancelled: { label: "Order cancelled", tone: "neutral" } }} />
                        ) : (
                          <StateBadge state={approval.status} map={APPROVAL_STATES} />
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/account/approvals/${approval.flowId}`}
                          className="whitespace-nowrap text-orange-800"
                          aria-label={`${approval.status === "Pending" ? "Review" : "View"} order ${orderReference(order)}`}
                        >
                          {approval.status === "Pending" ? "Review" : "View"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-200">
              <ListToolbar page={page} size={size} total={result.total} label="Approvals" hrefFor={hrefFor} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
