import { NextResponse } from "next/server";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { currentBrowseContext } from "@/features/business-units/context";
import { getActiveCart } from "@/features/cart/service";
import { formatMoney } from "@/lib/utils";

// The visitor's own cart in one line (item count and total), for the mini-cart on cached guest pages: the page is
// shared, this answer is per visitor and never cached.
export async function GET() {
  let summary: { items: number; total?: string } = { items: 0 };
  try {
    const { auth, context, cartId } = await currentBrowseContext();
    const cart = auth ? await getActiveCart(auth, cartId, context) : undefined;
    if (cart) {
      summary = { items: cart.lineItems.reduce((n, l) => n + l.quantity, 0), total: formatMoney(cart.taxedPrice?.totalGross ?? cart.totalPrice) };
    }
  } catch (err) {
    // An expired or revoked token means "no cart" here; the full pages handle signing out.
    if (!isRedirectError(err)) console.error("cart summary failed", (err as { body?: unknown })?.body ?? err);
  }
  return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store" } });
}
