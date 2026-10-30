import { NextResponse, connection } from "next/server";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { currentBrowseContext } from "@/features/business-units/context";
import { getActiveCart } from "@/features/cart/service";
import { EMPTY_MINICART, toMiniCart, type MiniCartSummary } from "@/features/cart/minicart";

// The visitor's own minicart (lines, subtotal, count), for reloading the minicart after a change. Per visitor and never
// cached: connection() keeps it out of the build's prerender (the catch below would otherwise swallow the signal).
export async function GET() {
  await connection();
  let summary: MiniCartSummary = EMPTY_MINICART;
  try {
    const { auth, context, cartId } = await currentBrowseContext();
    summary = toMiniCart(auth ? await getActiveCart(auth, cartId, context) : undefined, context.canOrder);
  } catch (err) {
    // An expired or revoked token means "no cart" here; the full pages handle signing out.
    if (!isRedirectError(err)) console.error("cart summary failed", (err as { body?: unknown })?.body ?? err);
  }
  return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store" } });
}
