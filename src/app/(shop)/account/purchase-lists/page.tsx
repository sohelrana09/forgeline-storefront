import { requireShopContext } from "@/features/business-units/context";
import { PurchaseListsView } from "@/features/purchase-lists/components/PurchaseListsView";
import { listParams } from "@/components/ui/ListToolbar";

export const dynamic = "force-dynamic";

type Search = { page?: string; limit?: string; deleted?: string };

export default async function PurchaseListsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [{ session, context }, { page, limit, deleted }] = await Promise.all([requireShopContext(), searchParams]);
  return <PurchaseListsView session={session} context={context} {...listParams(page, limit)} deleted={deleted === "1"} />;
}
