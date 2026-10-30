import type { Metadata } from "next";
import { requireBusinessContext } from "@/features/business-units/context";
import { QuoteView } from "@/features/quotes/components/QuoteView";

export const metadata: Metadata = { title: "Quote" };

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { session, context }] = await Promise.all([params, requireBusinessContext()]);
  return <QuoteView session={session} context={context} id={id} />;
}
