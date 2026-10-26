import Link from "next/link";
import { pageMyOrders } from "@/features/orders/service";
import { getCompanyMembers, pageCompanyOrders } from "@/features/company/service";
import { can } from "@/features/company/utils";
import { OrdersTable } from "@/features/orders/components/OrdersTable";
import { approvalsForOrders } from "@/features/approvals/service";
import { ListToolbar } from "@/components/ui/ListToolbar";
import type { Session } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";

// `page` and `size` come from ListToolbar's listParams (already clamped). `company`: all of the unit's orders,
// offered to associates with ViewOthersOrders (re-checked live in the service).
export async function OrdersListView({
  session,
  context,
  page,
  size,
  company = false,
}: {
  session: Session;
  context: BuyerContext;
  page: number;
  size: number;
  company?: boolean;
}) {
  const seeOthers = can(context, "ViewOthersOrders");
  // The permission comes from the 5-minute memo; the service re-checks it live and refuses if it was just revoked.
  // Company orders and the members' names together (one unit read between them, shared per render).
  const [companyPage, members] =
    company && seeOthers
      ? await Promise.all([
          pageCompanyOrders(context, session.customerId, page, size).catch(() => undefined),
          getCompanyMembers(context, session.customerId).catch(() => []),
        ])
      : [undefined, []];
  const all = Boolean(companyPage);
  const names = all ? Object.fromEntries(members.map((m) => [m.customerId, m.name || m.email])) : undefined;
  const { orders, total } = companyPage ?? (await pageMyOrders(session, context, page, size));
  // Orders that matched an approval rule (business units only).
  const approvals = await approvalsForOrders(
    context,
    session.customerId,
    orders.map((o) => o.id),
  );
  const hrefFor = (p: number, s: number) =>
    `/account/orders?${new URLSearchParams({ ...(all && { scope: "company" }), ...(p > 1 && { page: String(p) }), ...(s !== 10 && { limit: String(s) }) })}`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="m-0 text-2xl font-bold">{all ? "Company orders" : "My orders"}</h1>
        {total > 0 && (
          <p className="m-0 mt-1 text-sm text-gray-600">
            {total} {total === 1 ? "order" : "orders"} {all ? "by everyone in" : "for"} {context.businessUnitName} · {context.storeName}
          </p>
        )}
      </div>
      {seeOthers && (
        <nav aria-label="Whose orders" className="flex gap-2">
          {[
            { href: "/account/orders", label: "My orders", active: !all },
            { href: "/account/orders?scope=company", label: "All company orders", active: all },
          ].map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-full border px-4 text-sm no-underline ${
                t.active
                  ? "border-gray-900 bg-gray-900 font-semibold text-white"
                  : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}
      <section aria-label="Orders" className="rounded-md border border-gray-200 bg-white">
        {total === 0 ? (
          <div className="flex flex-col items-start gap-3 p-5">
            <p className="m-0 text-sm text-gray-600">
              {all ? "No orders" : "You have placed no orders"} for {context.businessUnitName}.
            </p>
            <Link href="/c/spare_parts" className="text-sm text-orange-800">
              Shop spare parts
            </Link>
          </div>
        ) : (
          <>
            <OrdersTable
              orders={orders}
              canOrder={context.canOrder}
              ownerId={all ? session.customerId : undefined}
              names={names}
              approvals={approvals}
            />
            <div className="border-t border-gray-200">
              <ListToolbar page={page} size={size} total={total} label="Orders" hrefFor={hrefFor} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
