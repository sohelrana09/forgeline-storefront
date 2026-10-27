import type { BaseAddress, Cart } from "@commercetools/platform-sdk";
import { formatMoney } from "@/lib/utils";
import type { ShippingOption } from "@/features/cart/service";

export type MethodOption = { key: string; name: string; price: string; note?: string };

// One address as lines (company, street, postcode and city, region and country).
export const addressLabel = (a: BaseAddress) =>
  [
    [a.firstName, a.lastName].filter(Boolean).join(" "),
    a.company,
    [a.streetName, a.streetNumber].filter(Boolean).join(" "),
    [a.postalCode, a.city].filter(Boolean).join(" "),
    [a.state, a.country].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join("\n");

// Shipping methods as the checkout shows them: the price this cart would pay ("Free" above the threshold) and the method.
export function methodOptions(options: ShippingOption[], cart: Cart): MethodOption[] {
  const subtotal = cart.lineItems.reduce((sum, l) => sum + l.totalPrice.centAmount, 0);
  return options.map((o) => {
    const free = o.freeAbove && subtotal >= o.freeAbove.centAmount;
    return {
      key: o.key,
      name: o.name,
      price: free || o.price?.centAmount === 0 ? "Free" : o.price ? formatMoney(o.price) : "On request",
      note: o.freeAbove && !free ? `Free above ${formatMoney(o.freeAbove)}` : undefined,
    };
  });
}
