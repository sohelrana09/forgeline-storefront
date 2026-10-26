import Link from "next/link";
import { notFound } from "next/navigation";
import type { Session } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";
import { CartSummary } from "@/features/cart/components/CartSummary";
import { getMyQuote } from "@/features/quotes/service";
import { QUOTE_STATES, isActionable, isExpired, shortRef } from "@/features/quotes/utils";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LineItemsList } from "@/features/quotes/components/LineItemsList";
import { QuoteDecisionForms } from "@/features/quotes/components/QuoteForms";
import { StateBadge } from "@/components/ui/StateBadge";

export async function QuoteView({ session, context, id }: { session: Session; context: BuyerContext; id: string }) {
  const quote = await getMyQuote(session, context, id);
  if (!quote) notFound();
  const expired = isExpired(quote);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "My account", href: "/account" },
          { label: "My quotes", href: "/account/quotes" },
          { label: `Quote ${shortRef(quote)}` },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-2xl font-bold">Quote {shortRef(quote)}</h1>
        <StateBadge state={quote.quoteState} map={QUOTE_STATES} />
      </div>
      <p className="m-0 text-sm text-gray-600">
        {quote.validTo ? `Valid until ${new Date(quote.validTo).toLocaleDateString("en-GB")}` : "No expiry date"}
        {expired && " · expired"}
        {" · for "}
        <Link href={`/account/quotes/requests/${quote.quoteRequest.id}`} className="text-orange-800">
          request {quote.quoteRequest.id.slice(0, 8).toUpperCase()}
        </Link>
      </p>
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-6">
          {quote.sellerComment && (
            <section className="rounded-md border border-blue-200 bg-blue-50 p-5 text-blue-950">
              <h2 className="m-0 mb-2 text-sm font-semibold uppercase tracking-wide">From our sales team</h2>
              <p className="m-0 whitespace-pre-line">{quote.sellerComment}</p>
            </section>
          )}
          {quote.buyerComment && (
            <section className="rounded-md border border-gray-200 bg-white p-5">
              <h2 className="m-0 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">Your change request</h2>
              <p className="m-0 whitespace-pre-line">{quote.buyerComment}</p>
            </section>
          )}
          <section aria-label="Quoted items" className="rounded-md border border-gray-200 bg-white">
            <LineItemsList lines={quote.lineItems} />
          </section>
        </div>
        <div className="flex w-full flex-col gap-4 md:max-w-sm md:flex-[1_1_320px]">
          <CartSummary cart={quote} title="Quoted total" />
          {isActionable(quote) && context.canOrder ? (
            <QuoteDecisionForms id={quote.id} version={quote.version} />
          ) : quote.quoteState === "Pending" && expired ? (
            <p className="m-0 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              This quote has expired. Request a new quote from your cart.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
