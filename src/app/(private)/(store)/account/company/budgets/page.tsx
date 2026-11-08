import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBusinessContext } from "@/features/business-units/context";
import { spendingLimitsEnabled } from "@/features/spending-limits/budget";
import { BudgetsView } from "@/features/spending-limits/components/BudgetsView";

export const metadata: Metadata = { title: "Budgets" };

export default async function BudgetsPage() {
  if (!spendingLimitsEnabled()) notFound();
  const { session, context } = await requireBusinessContext();
  return <BudgetsView session={session} context={context} />;
}
