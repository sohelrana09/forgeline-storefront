import Image from "next/image";
import type { Cart } from "@commercetools/platform-sdk";
import { formatMoney } from "@/lib/utils";
import { localize } from "@/features/catalog/utils";

// The "N Items in Cart" list in the order summary: picture, name, quantity and line total.
export function CheckoutItems({ cart }: { cart: Cart }) {
  const count = cart.lineItems.reduce((n, l) => n + l.quantity, 0);
  return (
    <details open={cart.lineItems.length <= 4} className="rounded-md border border-gray-200 bg-white p-5 text-sm">
      <summary className="cursor-pointer text-base font-semibold">
        {count} {count === 1 ? "item" : "items"} in cart
      </summary>
      <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
        {cart.lineItems.map((l) => {
          const image = l.variant.images?.[0]?.url;
          return (
            <li key={l.id} className="flex items-start gap-3">
              {image ? (
                <Image
                  src={image}
                  alt=""
                  width={56}
                  height={56}
                  sizes="56px"
                  className="size-14 shrink-0 rounded border border-gray-100 object-contain"
                />
              ) : (
                <span className="size-14 shrink-0 rounded bg-gray-100" />
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{localize(l.name)}</span>
                <span className="text-xs text-gray-600">
                  Qty {l.quantity} · <span className="font-mono">{l.variant.sku}</span>
                </span>
              </span>
              <span className="shrink-0 font-semibold">{formatMoney(l.totalPrice)}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
