import type { Metadata } from "next";
import { requireShopContext } from "@/features/business-units/context";
import { PurchaseListView } from "@/features/purchase-lists/components/PurchaseListsView";

export const metadata: Metadata = { title: "Purchase list" };

export default async function PurchaseListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scope?: string | string[] }>;
}) {
  const [{ session, context }, { id }, { scope }] = await Promise.all([requireShopContext(), params, searchParams]);
  return <PurchaseListView session={session} context={context} id={id} scope={scope === "company" ? "company" : "mine"} />;
}
