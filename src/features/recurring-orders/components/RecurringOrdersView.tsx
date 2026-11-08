import { dateLocale } from "@/lib/i18n";
import Link from "next/link";
import { listMyRecurringOrders } from "@/features/recurring-orders/service";
import { STATE_LABEL } from "@/features/recurring-orders/schedule";
import { RecurringOrderButtons } from "@/features/recurring-orders/components/RecurringForms";
import type { Session } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";

const day = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(dateLocale(), { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "–";

// /account/recurring-orders: the buyer's own recurring orders in the selected unit.
export async function RecurringOrdersView({ session, context }: { session: Session; context: BuyerContext }) {
  const orders = await listMyRecurringOrders(session, context);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="m-0 text-2xl font-bold">My recurring orders</h1>
        <p className="m-0 mt-1 text-sm text-gray-600">
          Orders placed for you on a schedule, at each day&apos;s prices. You get an email two days before each one.
        </p>
      </div>
      {orders.length === 0 ? (
        <div className="rounded-md border border-gray-200 bg-white p-6 text-sm">
          <p className="m-0">You have no recurring orders yet.</p>
          <p className="m-0 mt-1 text-gray-600">
            Open a past order in <Link href="/account/orders">My orders</Link> or a{" "}
            <Link href="/account/purchase-lists">purchase list</Link> and choose &ldquo;Set up recurring order&rdquo;.
          </p>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {orders.map((r) => (
            <li key={r.id} className="rounded-md border border-gray-200 bg-white p-5 text-sm">
              <section aria-label={`Recurring order, ${r.schedule.toLowerCase()}`} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="m-0 text-base font-semibold">{r.schedule}</h2>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold">{STATE_LABEL[r.state] ?? r.state}</span>
                </div>
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  <dt className="text-gray-600">Next order</dt>
                  <dd className="m-0">
                    {day(r.nextOrderAt ?? r.startsAt)}
                    {r.skips > 0 && ` (skipping ${r.skips === 1 ? "the next order" : `the next ${r.skips} orders`})`}
                  </dd>
                  <dt className="text-gray-600">Last order</dt>
                  <dd className="m-0">{day(r.lastOrderAt)}</dd>
                  {r.total && (
                    <>
                      <dt className="text-gray-600">Today&apos;s total</dt>
                      <dd className="m-0">{r.total}</dd>
                    </>
                  )}
                </dl>
                <ul className="m-0 list-disc pl-5">
                  {r.lines.map((l) => (
                    <li key={l.sku}>
                      {l.quantity} × {l.name} <span className="text-gray-600">({l.sku})</span>
                    </li>
                  ))}
                </ul>
                {r.state === "Failed" && (
                  <p className="m-0 text-red-800">The last run failed (for example out of stock). Resume it once the cause is solved.</p>
                )}
                {r.ops.length > 0 && <RecurringOrderButtons id={r.id} ops={r.ops} />}
              </section>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
