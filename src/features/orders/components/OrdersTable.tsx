import Link from "next/link";
import type { Order } from "@commercetools/platform-sdk";
import { formatMoney } from "@/lib/utils";
import { StateBadge } from "@/components/ui/StateBadge";
import { orderReference } from "@/features/orders/service";
import { ORDER_STATES } from "@/features/orders/utils";
import { ReorderButton } from "@/features/orders/components/ReorderButton";
import { APPROVAL_STATES } from "@/features/approvals/utils";
import type { OrderApproval } from "@/features/approvals/types";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB");

// Magento's order grid: Order #, Date, Ship To, PO, Order Total, Status, then View Order / Reorder.
// `ownerId` set: a company-wide list, so show who placed each order (`names`: customer id → colleague's name;
// orders placed with a customer token carry no email) and offer Reorder only on the user's own. `approvals`: order id →
// its approval (orders that matched an approval rule), shown next to the order status.
export function OrdersTable({
  orders,
  canOrder,
  ownerId,
  names = {},
  approvals = {},
}: {
  orders: Order[];
  canOrder: boolean;
  ownerId?: string;
  names?: Record<string, string>;
  approvals?: Record<string, OrderApproval>;
}) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
            <th className="px-5 py-2.5 font-semibold">Order #</th>
            <th className="px-3 py-2.5 font-semibold">Date</th>
            {ownerId && <th className="px-3 py-2.5 font-semibold">Placed by</th>}
            <th className="px-3 py-2.5 font-semibold">Ship to</th>
            <th className="px-3 py-2.5 font-semibold">PO</th>
            <th className="px-3 py-2.5 text-right font-semibold">Order total</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
            <th className="px-5 py-2.5 font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const ship = o.shippingAddress;
            return (
              <tr key={o.id} className="border-t border-gray-100">
                <td className="px-5 py-3 font-mono">{orderReference(o)}</td>
                <td className="px-3 py-3">{date(o.createdAt)}</td>
                {ownerId && (
                  <td className="px-3 py-3">
                    {o.customerId === ownerId ? "You" : (names[o.customerId ?? ""] ?? o.customerEmail ?? "Former user")}
                  </td>
                )}
                <td className="px-3 py-3">{ship ? [ship.company, ship.city].filter(Boolean).join(", ") : "None"}</td>
                <td className="px-3 py-3">{o.purchaseOrderNumber ?? "None"}</td>
                <td className="px-3 py-3 text-right font-semibold">{formatMoney(o.taxedPrice?.totalGross ?? o.totalPrice)}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {/* A pending approval replaces the plain "Pending"; a rejected one explains the cancellation. */}
                    {approvals[o.id]?.status !== "Pending" && <StateBadge state={o.orderState} map={ORDER_STATES} />}
                    {approvals[o.id] && <StateBadge state={approvals[o.id].status} map={APPROVAL_STATES} />}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                    <Link href={`/account/orders/${o.id}`} className="text-orange-800" aria-label={`View order ${orderReference(o)}`}>
                      View order
                    </Link>
                    {canOrder && (!ownerId || o.customerId === ownerId) && (
                      <ReorderButton orderId={o.id} label={`Reorder ${orderReference(o)}`} />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
