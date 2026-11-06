import { NextResponse, type NextRequest } from "next/server";
import type { Cart } from "@commercetools/platform-sdk";
import { hasPriceExtensionSecret } from "@/lib/revalidate-auth";
import { hasExternalPricing } from "@/features/business-units/service";
import { companyLadders } from "@/features/company-pricing/service";
import { cartSkus, priceActions } from "@/features/company-pricing/extension";

// The commercetools API Extension for carts (registered by `npm run ct:nz-trade -- --extension`): on every cart create
// and update in an externalPricing store (condition on the extension), it answers the company price of each line as
// `setLineItemPrice` actions with an `externalPrice`, which commercetools applies in the same request.
// commercetools waits at most 2 seconds. If the price store fails, the answer is a validation error, so the cart
// change fails instead of charging the web price.
export async function POST(request: NextRequest) {
  if (!hasPriceExtensionSecret(request.headers.get("authorization")))
    return NextResponse.json({ message: "unauthorized" }, { status: 401 });

  const input = (await request.json().catch(() => undefined)) as { resource?: { typeId?: string; obj?: Cart } } | undefined;
  const cart = input?.resource?.typeId === "cart" ? input.resource.obj : undefined;
  const company = cart?.businessUnit?.key;
  if (!cart || !company || !hasExternalPricing(cart.store?.key) || cart.lineItems.length === 0) return NextResponse.json({ actions: [] });

  try {
    const ladders = await companyLadders(company, cartSkus(cart), { live: true });
    return NextResponse.json({ actions: priceActions(cart, ladders) });
  } catch (err) {
    console.error("price extension: price store failed", company, err);
    return NextResponse.json(
      { errors: [{ code: "InvalidOperation", message: "Company prices are unavailable right now. Please try again." }] },
      { status: 400 },
    );
  }
}
