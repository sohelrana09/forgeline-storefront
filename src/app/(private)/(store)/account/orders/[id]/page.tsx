import type { Metadata } from "next";
import { requireShopContext } from "@/features/business-units/context";
import { OrderView } from "@/features/orders/components/OrderView";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ po?: string; reorder?: string; changed?: string }>;
}) {
  const [{ id }, { po, reorder, changed }, { session, context }] = await Promise.all([params, searchParams, requireShopContext()]);
  return (
    <OrderView
      session={session}
      context={context}
      id={id}
      poFailed={po === "failed"}
      reorderFailed={reorder === "failed"}
      totalChanged={changed === "1"}
    />
  );
}
