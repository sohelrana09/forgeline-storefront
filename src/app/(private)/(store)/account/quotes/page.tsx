import type { Metadata } from "next";
import { requireBusinessContext } from "@/features/business-units/context";
import { QuotesListView, type QuoteListParams } from "@/features/quotes/components/QuotesListView";

export const metadata: Metadata = { title: "My quotes" };

export default async function QuotesPage({ searchParams }: { searchParams: Promise<QuoteListParams> }) {
  const [params, { session, context }] = await Promise.all([searchParams, requireBusinessContext()]);
  return <QuotesListView session={session} context={context} params={params} />;
}
