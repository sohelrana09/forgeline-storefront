import { requireShopContext } from "@/features/business-units/context";
import { PurchaseListView } from "@/features/purchase-lists/components/PurchaseListsView";

export const dynamic = "force-dynamic";

export default async function PurchaseListPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ session, context }, { id }] = await Promise.all([requireShopContext(), params]);
  return <PurchaseListView session={session} context={context} id={id} />;
}
