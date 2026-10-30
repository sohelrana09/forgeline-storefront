import type { Metadata } from "next";
import { requireBrowseContext } from "@/features/business-units/context";
import { QuickOrderView } from "@/features/quick-order/components/QuickOrderView";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Power-buyer page: paste SKUs, or scan the whole catalog as a table.
export default async function QuickOrderPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const [{ page }, { context }] = await Promise.all([searchParams, requireBrowseContext()]);
  return <QuickOrderView context={context} page={Number.parseInt(page ?? "1", 10) || 1} />;
}
