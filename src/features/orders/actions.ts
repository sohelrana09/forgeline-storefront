"use server";

import { redirect } from "next/navigation";
import { requireShopContext } from "@/features/business-units/context";
import { getMyOrder } from "@/features/orders/service";
import { addParsedLines } from "@/features/quick-order/service";
import { UUID } from "@/features/orders/utils";

// Public endpoint: "Reorder". Puts the lines of one of the buyer's own orders back into the cart of the
// selected unit at today's prices (SKUs the store no longer sells are skipped by the quick-order checks).
export async function reorder(formData: FormData) {
  const id = String(formData.get("orderId") ?? "");
  const { session, context } = await requireShopContext();
  if (!context.canOrder || !UUID.test(id)) return;
  const order = await getMyOrder(session, context, id);
  if (!order || (order.businessUnit?.key ?? "") !== context.businessUnitKey) return;
  const lines = order.lineItems.flatMap((l) => (l.variant.sku ? [`${l.variant.sku}, ${l.quantity}`] : []));
  const result = lines.length > 0 ? await addParsedLines(lines.join("\n")) : undefined;
  // Nothing could be added (no longer sold, cart error): stay on the order and say so.
  if (!result || result.added.length === 0) redirect(`/account/orders/${id}?reorder=failed`);
  redirect("/cart");
}
