import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { localize } from "@/features/catalog/utils";
import { formatMoney } from "@/lib/utils";
import { StateBadge } from "@/components/ui/StateBadge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CartSummary } from "@/features/cart/components/CartSummary";
import { ApprovalError, getApproval } from "@/features/approvals/service";
import { APPROVAL_STATES } from "@/features/approvals/utils";
import { ApprovalDecisionForm, RetryCancelForm } from "@/features/approvals/components/ApprovalDecisionForm";
import { getCompanyMembers, getRoles } from "@/features/company/service";
import { roleLabel } from "@/features/company/utils";
import { orderReference } from "@/features/orders/service";
import type { Session } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";
import { productHref } from "@/features/catalog/utils";

// One order waiting for (or past) approval: who asked, which rule, the items and totals, the history, and the
// approver's decision. Only for associates with UpdateApprovalFlows (checked live in the service).
export async function ApprovalView({ session, context, id }: { session: Session; context: BuyerContext; id: string }) {
  const result = await getApproval(context, session.customerId, id).catch((err) => {
    if (err instanceof ApprovalError) redirect("/account");
    throw err;
  });
  if (!result || (result.order.businessUnit?.key ?? "") !== context.businessUnitKey) notFound();
  const { approval, order, canDecide, cancelPending, ownOrder } = result;
  const [members, roles] = await Promise.all([getCompanyMembers(context, session.customerId).catch(() => []), getRoles()]);
  const nameOf = (cid?: string) =>
    cid === session.customerId ? "you" : (members.find((m) => m.customerId === cid)?.name ?? "a former user");
  const ref = orderReference(order);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "My account", href: "/account" },
          { label: "Order approvals", href: "/account/approvals" },
          { label: `Order ${ref}` },
        ]}
      />
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 text-2xl font-bold">Order # {ref}</h1>
          <StateBadge state={approval.status} map={APPROVAL_STATES} />
        </div>
        <p className="m-0 text-sm text-gray-600">
          Requested {new Date(order.createdAt).toLocaleString("en-GB")} by {nameOf(order.customerId)}
          {order.purchaseOrderNumber && ` · PO ${order.purchaseOrderNumber}`} ·{" "}
          {formatMoney(order.taxedPrice?.totalGross ?? order.totalPrice)}
        </p>
      </div>

      <section aria-labelledby="decision" className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-5 text-sm">
        <h2 id="decision" className="m-0 text-lg font-semibold">
          Approval
        </h2>
        <p className="m-0 text-gray-700">
          Rule: {approval.rules.join(", ")}.
          {approval.status === "Pending" && ` Can approve: ${approval.pendingRoles.map((r) => roleLabel(r, roles)).join(" or ")}.`}
        </p>
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-gray-700">
          {approval.approvals.map((a) => (
            <li key={`${a.by}-${a.at}`}>
              Approved by {nameOf(a.by)} on {new Date(a.at).toLocaleString("en-GB")}
            </li>
          ))}
          {approval.rejection && (
            <li>
              Rejected by {nameOf(approval.rejection.by)} on {new Date(approval.rejection.at).toLocaleString("en-GB")}:{" "}
              <q>{approval.rejection.reason}</q>{" "}
              {order.orderState === "Cancelled" ? "The order was cancelled." : "Cancelling the order is still pending."}
            </li>
          )}
        </ul>
        {cancelPending ? (
          <RetryCancelForm flowId={approval.flowId} version={approval.version} />
        ) : canDecide ? (
          <ApprovalDecisionForm flowId={approval.flowId} version={approval.version} />
        ) : (
          approval.status === "Pending" && (
            <p className="m-0 rounded border border-gray-200 bg-gray-50 p-3 text-gray-700">
              {order.orderState === "Cancelled"
                ? "This order was cancelled, so it no longer needs approval."
                : ownOrder
                  ? "This is your own order: another approver has to decide it."
                  : "Your role can't decide this step of the approval."}
            </p>
          )
        )}
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-labelledby="items" className="min-w-0 flex-[999_1_480px] rounded-md border border-gray-200 bg-white">
          <h2 id="items" className="m-0 border-b border-gray-200 px-5 py-4 text-lg font-semibold">
            Items ordered
          </h2>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
                  <th className="px-5 py-2.5 font-semibold">Product</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Price</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Qty</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.lineItems.map((line) => (
                  <tr key={line.id} className="border-t border-gray-100">
                    <td className="px-5 py-3">
                      <Link href={productHref(line.productSlug, line.variant.sku)} className="font-semibold text-gray-900">
                        {localize(line.name)}
                      </Link>
                      <div className="font-mono text-xs text-gray-600">{line.variant.sku}</div>
                    </td>
                    <td className="px-3 py-3 text-right">{formatMoney(line.price.discounted?.value ?? line.price.value)}</td>
                    <td className="px-3 py-3 text-right">{line.quantity}</td>
                    <td className="px-5 py-3 text-right font-semibold">{formatMoney(line.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="w-full md:max-w-sm md:flex-[1_1_320px]">
          <CartSummary cart={order} title="Order totals" />
        </div>
      </div>
    </div>
  );
}
