import { requireShopContext } from "@/features/business-units/context";
import { PurchaseListsView } from "@/features/purchase-lists/components/PurchaseListsView";
import { listParams } from "@/components/ui/ListToolbar";

type Search = { page?: string; cpage?: string; limit?: string; deleted?: string };

export default async function PurchaseListsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [{ session, context }, { page, cpage, limit, deleted }] = await Promise.all([requireShopContext(), searchParams]);
  return (
    <PurchaseListsView
      session={session}
      context={context}
      {...listParams(page, limit)}
      companyPage={listParams(cpage, limit).page}
      deleted={deleted === "1"}
    />
  );
}
