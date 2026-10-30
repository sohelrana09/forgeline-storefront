import type { Metadata } from "next";
import { requireBusinessContext } from "@/features/business-units/context";
import { QuoteRequestView } from "@/features/quotes/components/QuoteRequestView";

export const metadata: Metadata = { title: "Quote request" };

export default async function QuoteRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { session, context }] = await Promise.all([params, requireBusinessContext()]);
  return <QuoteRequestView session={session} context={context} id={id} />;
}
