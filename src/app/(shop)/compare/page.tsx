import type { Metadata } from "next";
import { requireBrowseContext } from "@/features/business-units/context";
import { parseCompareSkus } from "@/features/compare/compare";
import { CompareView } from "@/features/compare/components/CompareView";

export const metadata: Metadata = { title: "Compare products", robots: { index: false, follow: true } };

// /compare?skus=a,b,c: up to four products side by side at the visitor's prices.
export default async function ComparePage({ searchParams }: { searchParams: Promise<{ skus?: string | string[] }> }) {
  const [{ skus }, { context }] = await Promise.all([searchParams, requireBrowseContext()]);
  return <CompareView context={context} skus={parseCompareSkus(skus)} />;
}
