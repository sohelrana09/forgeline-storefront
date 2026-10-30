import { firstParam } from "@/lib/utils";
import type { Metadata } from "next";
import { requireBrowseContext } from "@/features/business-units/context";
import { CartView } from "@/features/cart/components/CartView";

export const metadata: Metadata = { title: "Shopping cart", robots: { index: false, follow: false } };

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ merged?: string | string[]; skipped?: string | string[] }>;
}) {
  const [{ auth, context, cartId }, { merged, skipped }] = await Promise.all([requireBrowseContext(), searchParams]);
  return <CartView auth={auth} context={context} cartId={cartId} merge={{ merged: firstParam(merged), skipped: firstParam(skipped) }} />;
}
