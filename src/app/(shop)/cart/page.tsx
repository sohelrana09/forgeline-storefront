import type { Metadata } from "next";
import { requireBrowseContext } from "@/features/business-units/context";
import { CartView } from "@/features/cart/components/CartView";

export const dynamic = "force-dynamic";

// Personal or transactional: never in search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CartPage({ searchParams }: { searchParams: Promise<{ merged?: string; skipped?: string }> }) {
  const [{ auth, context, cartId }, { merged, skipped }] = await Promise.all([requireBrowseContext(), searchParams]);
  return <CartView auth={auth} context={context} cartId={cartId} merge={{ merged, skipped }} />;
}
