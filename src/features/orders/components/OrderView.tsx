import Link from "next/link";
import { notFound } from "next/navigation";
import { localize } from "@/features/catalog/utils";
import { getMyOrder, orderReference } from "@/features/orders/service";
import { getCompanyMembers, getCompanyOrder } from "@/features/company/service";
import { can } from "@/features/company/utils";
import { ORDER_STATES } from "@/features/orders/utils";
import { AddressBlock } from "@/features/account/components/AddressBlock";
import { formatMoney } from "@/lib/utils";
import { CartSummary } from "@/features/cart/components/CartSummary";
import { ReorderButton } from "@/features/orders/components/ReorderButton";
import { StateBadge } from "@/components/ui/StateBadge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { approvalsForOrders } from "@/features/approvals/service";
import { APPROVAL_STATES } from "@/features/approvals/utils";
import type { Session } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";
import { productHref } from "@/features/catalog/utils";

// Magento-style order view: status and actions, items ordered, totals, then order information (addresses,
// shipping method, payment method). Right after checkout it doubles as the confirmation page.
export async function OrderView({
  session,
  context,
  id,
  poFailed = false,
  reorderFailed = false,
  totalChanged = false,
}: {
  session: Session;
  context: BuyerContext;
  id: string;
  poFailed?: boolean;
  reorderFailed?: boolean;
  totalChanged?: boolean;
}) {
  // Read with the buyer's own token: someone else's order id simply isn't found. Associates who may see
  // colleagues' orders (ViewOthersOrders, checked live) get the unit's order through the company service.
  const own = await getMyOrder(session, context, id);
  const order = own ?? (can(context, "ViewOthersOrders") ? await getCompanyOrder(context, session.customerId, id) : undefined);
  if (!order || (order.businessUnit?.key ?? "") !== context.businessUnitKey) notFound();
  const mine = order.customerId === session.customerId;
  // Its approval and the colleagues' names (who placed it, if not you, and who decided the approval), together.
  const [approvals, members] = await Promise.all([
    approvalsForOrders(context, session.customerId, [order.id]),
    context.consumer ? [] : getCompanyMembers(context, session.customerId).catch(() => []),
  ]);
  const approval = approvals[order.id];
  const nameOf = (id?: string) => (id === session.customerId ? "you" : (members.find((m) => m.customerId === id)?.name ?? "a former user"));
  const placedBy = mine
    ? undefined
    : (members.find((m) => m.customerId === order.customerId)?.name ?? order.customerEmail ?? "a former user");
  const ref = orderReference(order);
  const isNew = Date.now() - new Date(order.createdAt).getTime() < 10 * 60 * 1000;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[{ label: "My account", href: "/account" }, { label: "My orders", href: "/account/orders" }, { label: `Order ${ref}` }]}
      />
      {poFailed && !order.purchaseOrderNumber && (
        <p role="alert" className="m-0 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900">
          Your order was placed, but the PO number couldn&apos;t be saved. Please send it to our sales team with the order reference.
        </p>
      )}
      {totalChanged && (
        <p role="alert" className="m-0 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950">
          Your cart changed while you were paying, so this order&apos;s total differs from the one you reviewed. Please check the items
          below, and contact us if something isn&apos;t right.
        </p>
      )}
      {reorderFailed && (
        <p role="alert" className="m-0 rounded-md border border-red-200 bg-red-50 p-4 text-red-900">
          None of this order&apos;s products could be added to your cart. They may no longer be sold to {context.businessUnitName}.
        </p>
      )}
      {isNew && mine && approval?.status === "Pending" ? (
        <p role="status" className="m-0 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950">
          Thank you. Your order {ref} needs approval before it is processed ({approval.rules.join(", ")}). We&apos;ll email you when it has
          been approved or rejected.
        </p>
      ) : (
        isNew && (
          <p role="status" className="m-0 rounded-md border border-green-200 bg-green-50 p-4 text-green-900">
            Thank you. Your order {ref} has been placed{context.consumer ? "" : ` for ${context.businessUnitName}`}.
          </p>
        )
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-2xl font-bold">Order # {ref}</h1>
            {approval?.status !== "Pending" && <StateBadge state={order.orderState} map={ORDER_STATES} />}
            {approval && <StateBadge state={approval.status} map={APPROVAL_STATES} />}
          </div>
          <p className="m-0 text-sm text-gray-600">
            Placed {new Date(order.createdAt).toLocaleString("en-GB")}
            {placedBy && ` by ${placedBy}`}
            {order.purchaseOrderNumber && ` · PO ${order.purchaseOrderNumber}`}
            {order.quote && (
              <>
                {" · from "}
                <Link href={`/account/quotes/${order.quote.id}`} className="text-orange-800">
                  quote {order.quote.id.slice(0, 8).toUpperCase()}
                </Link>
              </>
            )}
          </p>
        </div>
        {context.canOrder && mine && <ReorderButton orderId={order.id} prominent />}
      </div>

      {approval && (
        <section aria-labelledby="approval" className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-5 text-sm">
          <h2 id="approval" className="m-0 text-lg font-semibold">
            Approval
          </h2>
          <p className="m-0 text-gray-700">
            {approval.status === "Pending"
              ? `This order needs approval before it is processed: ${approval.rules.join(", ")}.`
              : `Approval rule: ${approval.rules.join(", ")}.`}
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
          {approval.status === "Pending" && !mine && can(context, "UpdateApprovalFlows") && (
            <Link href={`/account/approvals/${approval.flowId}`} className="self-start font-semibold text-orange-800">
              Review this approval
            </Link>
          )}
        </section>
      )}

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
        <div className="flex w-full flex-col gap-4 md:max-w-sm md:flex-[1_1_320px]">
          <CartSummary cart={order} title="Order totals" />
        </div>
      </div>

      <section aria-labelledby="info" className="rounded-md border border-gray-200 bg-white">
        <h2 id="info" className="m-0 border-b border-gray-200 px-5 py-4 text-lg font-semibold">
          Order information
        </h2>
        <div className="grid gap-6 p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <InfoBlock title="Shipping address">
            <AddressBlock address={order.shippingAddress} />
          </InfoBlock>
          <InfoBlock title="Shipping method">{order.shippingInfo?.shippingMethodName ?? "None"}</InfoBlock>
          <InfoBlock title="Billing address">
            <AddressBlock address={order.billingAddress ?? order.shippingAddress} />
          </InfoBlock>
          <InfoBlock title="Payment method">
            <p className="m-0">
              {order.paymentInfo?.payments.length
                ? `Card${order.paymentState ? ` (${order.paymentState.toLowerCase()})` : ""}`
                : context.consumer
                  ? "Bank transfer (details in the order confirmation)"
                  : `Invoice to ${context.businessUnitName}`}
            </p>
            {order.purchaseOrderNumber && <p className="m-0">Purchase order: {order.purchaseOrderNumber}</p>}
          </InfoBlock>
        </div>
      </section>

      <Link href="/account/orders" className="text-sm text-orange-800">
        ‹ Back to my orders
      </Link>
    </div>
  );
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-gray-600">{title}</h3>
      <div className="text-gray-800">{children}</div>
    </div>
  );
}
