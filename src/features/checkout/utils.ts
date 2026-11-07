import { hasCode, statusOf } from "@/lib/commercetools/errors";
import { stockErrorMessage } from "@/features/cart/stock";
import type { BaseAddress, Cart, MyCartUpdateAction } from "@commercetools/platform-sdk";
import { formatMoney } from "@/lib/utils";
import type { ShippingOption } from "@/features/cart/service";

export type MethodOption = { key: string; name: string; price: string; note?: string };

// Takes every Payment off a cart (see placeBankTransferOrder).
export const removePaymentActions = (cart: Pick<Cart, "paymentInfo">): MyCartUpdateAction[] =>
  (cart.paymentInfo?.payments ?? []).map((p) => ({ action: "removePayment", payment: { typeId: "payment", id: p.id } }));

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

// Address fields that make two addresses the same place and recipient (ids, keys, phone and email aside).
const ADDRESS_FIELDS = [
  "country",
  "state",
  "region",
  "postalCode",
  "city",
  "streetName",
  "streetNumber",
  "additionalStreetInfo",
  "building",
  "apartment",
  "company",
  "firstName",
  "lastName",
] as const;

const norm = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");

// Whether a cart address (a copy without id or key) is this saved address. Cart addresses are copies, so the
// checkout matches them back by every field, not just country, city and street (two offices on one street).
export const sameAddress = (a: BaseAddress | undefined, b: BaseAddress | undefined) =>
  Boolean(a && b) && ADDRESS_FIELDS.every((f) => norm(a![f]) === norm(b![f]));

// The buyer chose a billing address of its own ("My billing and shipping address are the same" unticked):
// a new delivery address then leaves it alone.
export const ownBilling = (cart: Pick<Cart, "billingAddress" | "shippingAddress">) =>
  Boolean(cart.billingAddress && cart.shippingAddress) && !sameAddress(cart.billingAddress, cart.shippingAddress);

// The cart's chosen shipping method among the offered options, by the method's id (names can repeat).
export const selectedMethodKey = (options: Pick<ShippingOption, "id" | "key">[], cart: Pick<Cart, "shippingInfo">) =>
  options.find((o) => o.id === cart.shippingInfo?.shippingMethod?.id)?.key;

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

const CODE_MESSAGES: [string, string][] = [
  ["PriceChanged", "Prices changed. Please review your order."],
  ["ShippingMethodDoesNotMatchCart", "Your delivery method is no longer available. Please choose another."],
  ["MissingTaxRateForCountry", "We can't calculate tax for this address. Please check it or contact us."],
];

// What the buyer sees when commercetools refuses an order, or undefined for an unexpected error.
export function orderErrorMessage(err: unknown): string | undefined {
  const stock = stockErrorMessage(err);
  if (stock) return stock;
  const known = CODE_MESSAGES.find(([code]) => hasCode(err, code));
  if (known) return known[1];
  return statusOf(err) === 409 ? "Your cart changed. Please review it and place the order again." : undefined;
}
