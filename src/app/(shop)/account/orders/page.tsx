import { requireShopContext } from "@/features/business-units/context";
import { OrdersListView } from "@/features/orders/components/OrdersListView";
import { listParams } from "@/components/ui/ListToolbar";

export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string; limit?: string; scope?: string }> }) {
  const [{ page, limit, scope }, { session, context }] = await Promise.all([searchParams, requireShopContext()]);
  return <OrdersListView session={session} context={context} company={scope === "company"} {...listParams(page, limit)} />;
}
