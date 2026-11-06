import { getSession } from "@/features/auth/session";
import { ListPanelDetails } from "@/features/purchase-lists/components/ListPanelDetails";
import type { BuyerContext } from "@/features/business-units/types";

// "Add to purchase list" under Add to cart (product page) or the cart summary. Signed-in customers only: guests
// return before any cookie is read. The buyer's lists load when the panel opens: most product views never open it.
export async function AddToListPanel({ context, kind, sku }: { context: BuyerContext; kind: "product" | "cart"; sku?: string }) {
  if (context.guest) return null;
  const session = await getSession();
  if (!session) return null;
  return <ListPanelDetails sku={sku} kind={kind} />;
}
