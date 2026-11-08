import type { Cart } from "@commercetools/platform-sdk";
import { formatMoney } from "@/lib/utils";
import type { PricingContext } from "@/features/business-units/types";
import { getShippingOptions } from "@/features/cart/service";
import { freeShippingProgress } from "@/features/engagement/engagement";

// Cart page: how far the cart is from free shipping on its shipping method (the rate's freeAbove in commercetools).
// Nothing shows when the method has no threshold.
export async function FreeShippingBar({ context, cart }: { context: PricingContext; cart: Cart }) {
  if (cart.lineItems.length === 0) return null;
  const options = await getShippingOptions(context, cart.shippingAddress ?? context.defaultShippingAddress);
  const chosen = options.find((o) => o.id === cart.shippingInfo?.shippingMethod?.id) ?? options.find((o) => o.isDefault);
  const linesTotal = {
    currencyCode: cart.totalPrice.currencyCode,
    fractionDigits: cart.totalPrice.fractionDigits,
    centAmount: cart.lineItems.reduce((sum, l) => sum + l.totalPrice.centAmount, 0),
  };
  const progress = freeShippingProgress(linesTotal, chosen?.freeAbove);
  if (!progress) return null;
  return (
    <section aria-label="Free shipping" className="rounded-md border border-gray-200 bg-white p-4 text-sm">
      {progress.state === "free" ? (
        <p className="m-0 font-semibold text-green-800">Your order ships free.</p>
      ) : (
        <>
          <p className="m-0">
            Add <strong>{formatMoney(progress.remaining)}</strong> for free shipping{chosen ? ` (${chosen.name})` : ""}.
          </p>
          <div
            role="progressbar"
            aria-label="Progress to free shipping"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent}
            className="mt-2 h-2 overflow-hidden rounded bg-gray-200"
          >
            <div className="h-full bg-green-700" style={{ width: `${progress.percent}%` }} />
          </div>
        </>
      )}
    </section>
  );
}
