import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBusinessContext } from "@/features/business-units/context";
import { recurringOrdersEnabled } from "@/features/recurring-orders/schedule";
import { RecurringOrdersView } from "@/features/recurring-orders/components/RecurringOrdersView";

export const metadata: Metadata = { title: "My recurring orders" };

export default async function RecurringOrdersPage() {
  if (!recurringOrdersEnabled()) notFound();
  const { session, context } = await requireBusinessContext();
  return <RecurringOrdersView session={session} context={context} />;
}
