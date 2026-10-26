import Link from "next/link";
import type { Session } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";
import { countAwaitingQuotes, pageMyQuoteRequests, pageMyQuotes } from "@/features/quotes/service";
import { ListToolbar, listParams } from "@/components/ui/ListToolbar";
import { QUOTE_REQUEST_STATES, QUOTE_STATES, isExpired, shortRef } from "@/features/quotes/utils";
import { formatMoney } from "@/lib/utils";
import { StateBadge } from "@/components/ui/StateBadge";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB");

// Two grids, each with its own page and size in the URL: quotes (?page, ?limit) and requests (?rpage, ?rlimit).
export type QuoteListParams = { page?: string; limit?: string; rpage?: string; rlimit?: string };

export async function QuotesListView({ session, context, params }: { session: Session; context: BuyerContext; params: QuoteListParams }) {
  const q = listParams(params.page, params.limit);
  const r = listParams(params.rpage, params.rlimit);
  const [{ items: requests, total: requestTotal }, { items: quotes, total: quoteTotal }, awaiting] = await Promise.all([
    pageMyQuoteRequests(session, context, r.page, r.size),
    pageMyQuotes(session, context, q.page, q.size),
    countAwaitingQuotes(session, context),
  ]);
  const href = (next: Partial<Record<keyof QuoteListParams, number>>, anchor: string) => {
    const merged = { page: q.page, limit: q.size, rpage: r.page, rlimit: r.size, ...next };
    const defaults = { page: 1, limit: 10, rpage: 1, rlimit: 10 };
    const search = new URLSearchParams(
      Object.entries(merged).flatMap(([k, v]) => (v === defaults[k as keyof typeof defaults] ? [] : [[k, String(v)]])),
    ).toString();
    return `/account/quotes${search ? `?${search}` : ""}#${anchor}`;
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="m-0 text-2xl font-bold">My quotes</h1>
        <p className="m-0 mt-1 text-sm text-gray-600">
          {awaiting > 0
            ? `${awaiting} ${awaiting === 1 ? "quote is" : "quotes are"} waiting for your decision.`
            : `Quotes for ${context.businessUnitName}. Add machines to your cart and request a quote from the cart page.`}
        </p>
      </div>

      <section aria-labelledby="quotes" className="rounded-md border border-gray-200 bg-white">
        <h2 id="quotes" className="m-0 border-b border-gray-200 px-5 py-4 text-lg font-semibold">
          Quotes from our sales team
        </h2>
        {quotes.length === 0 ? (
          <p className="m-0 p-5 text-sm text-gray-600">No quotes yet.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
                  <th className="px-5 py-2.5 font-semibold">Quote</th>
                  <th className="px-3 py-2.5 font-semibold">Date</th>
                  <th className="px-3 py-2.5 font-semibold">Valid until</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="border-t border-gray-100">
                    <td className="px-5 py-3">
                      <Link href={`/account/quotes/${q.id}`} className="font-mono text-orange-800">
                        {shortRef(q)}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{date(q.createdAt)}</td>
                    <td className="px-3 py-3">{q.validTo ? `${date(q.validTo)}${isExpired(q) ? " (expired)" : ""}` : "None"}</td>
                    <td className="px-3 py-3">
                      <StateBadge state={q.quoteState} map={QUOTE_STATES} />
                    </td>
                    <td className="px-5 py-3 text-right font-semibold">{formatMoney(q.taxedPrice?.totalGross ?? q.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-gray-200">
          <ListToolbar
            page={q.page}
            size={q.size}
            total={quoteTotal}
            label="Quotes"
            hrefFor={(page, limit) => href({ page, limit }, "quotes")}
          />
        </div>
      </section>

      <section aria-labelledby="requests" className="rounded-md border border-gray-200 bg-white">
        <h2 id="requests" className="m-0 border-b border-gray-200 px-5 py-4 text-lg font-semibold">
          Your quote requests
        </h2>
        {requests.length === 0 ? (
          <p className="m-0 p-5 text-sm text-gray-600">No quote requests yet.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
                  <th className="px-5 py-2.5 font-semibold">Request</th>
                  <th className="px-3 py-2.5 font-semibold">Date</th>
                  <th className="px-3 py-2.5 font-semibold">Your message</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Cart total</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-5 py-3">
                      <Link href={`/account/quotes/requests/${r.id}`} className="font-mono text-orange-800">
                        {shortRef(r)}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{date(r.createdAt)}</td>
                    <td className="max-w-xs truncate px-3 py-3 text-gray-700">{r.comment ?? ""}</td>
                    <td className="px-3 py-3">
                      <StateBadge state={r.quoteRequestState} map={QUOTE_REQUEST_STATES} />
                    </td>
                    <td className="px-5 py-3 text-right">{formatMoney(r.taxedPrice?.totalGross ?? r.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-gray-200">
          <ListToolbar
            page={r.page}
            size={r.size}
            total={requestTotal}
            label="Quote requests"
            hrefFor={(rpage, rlimit) => href({ rpage, rlimit }, "requests")}
          />
        </div>
      </section>
    </div>
  );
}
