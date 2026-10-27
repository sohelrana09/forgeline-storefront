import Link from "next/link";
import { notFound } from "next/navigation";
import type { Session } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";
import { CartSummary } from "@/features/cart/components/CartSummary";
import { getMyQuoteRequest, quotesForRequest } from "@/features/quotes/service";
import { QUOTE_REQUEST_STATES, QUOTE_STATES, canCancelRequest, shortRef } from "@/features/quotes/utils";
import { formatMoney, isRecent } from "@/lib/utils";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CancelRequestForm } from "@/features/quotes/components/QuoteForms";
import { LineItemsList } from "@/features/quotes/components/LineItemsList";
import { StateBadge } from "@/components/ui/StateBadge";

export async function QuoteRequestView({ session, context, id }: { session: Session; context: BuyerContext; id: string }) {
  const request = await getMyQuoteRequest(session, context, id);
  if (!request) notFound();
  const quotes = await quotesForRequest(session, context, request.id);
  const justSent = request.quoteRequestState === "Submitted" && isRecent(request.createdAt, 10 * 60 * 1000);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "My account", href: "/account" },
          { label: "My quotes", href: "/account/quotes" },
          { label: `Request ${shortRef(request)}` },
        ]}
      />
      {justSent && (
        <p role="status" className="m-0 rounded-md border border-green-200 bg-green-50 p-4 text-green-900">
          Your quote request was sent. Our sales team will reply with a quote here.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-2xl font-bold">Quote request {shortRef(request)}</h1>
        <StateBadge state={request.quoteRequestState} map={QUOTE_REQUEST_STATES} />
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-6">
          {request.comment && (
            <section className="rounded-md border border-gray-200 bg-white p-5">
              <h2 className="m-0 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">Your message</h2>
              <p className="m-0 whitespace-pre-line">{request.comment}</p>
            </section>
          )}
          {quotes.length > 0 && (
            <section className="rounded-md border border-gray-200 bg-white p-5">
              <h2 className="m-0 mb-3 text-lg font-semibold">Quotes for this request</h2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {quotes.map((q) => (
                  <li key={q.id} className="flex flex-wrap items-center justify-between gap-3">
                    <Link href={`/account/quotes/${q.id}`} className="font-mono text-orange-800">
                      Quote {shortRef(q)}
                    </Link>
                    <StateBadge state={q.quoteState} map={QUOTE_STATES} />
                    <span className="font-semibold">{formatMoney(q.taxedPrice?.totalGross ?? q.totalPrice)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-label="Requested items" className="rounded-md border border-gray-200 bg-white">
            <LineItemsList lines={request.lineItems} />
          </section>
        </div>
        <div className="flex w-full flex-col gap-4 md:max-w-sm md:flex-[1_1_320px]">
          <CartSummary cart={request} title="Requested (list prices)" />
          {context.canOrder && canCancelRequest(request) && <CancelRequestForm id={request.id} />}
        </div>
      </div>
    </div>
  );
}
