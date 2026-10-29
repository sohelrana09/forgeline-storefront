// Quantity breaks (tier prices) of a commercetools Price (pure). A Standalone Price has a base `value` for one unit
// and optional `tiers` ({ minimumQuantity, value }): the cart prices a line at the highest tier its quantity reaches.
import type { Price, TypedMoney } from "@commercetools/platform-sdk";

export type PriceStep = { minimumQuantity: number; value: TypedMoney };

// The base price at 1, then each tier, lowest quantity first.
export function priceSteps(price: Price): PriceStep[] {
  const tiers = (price.tiers ?? []).filter((t) => t.minimumQuantity > 1).sort((a, b) => a.minimumQuantity - b.minimumQuantity);
  return [{ minimumQuantity: 1, value: price.value }, ...tiers];
}

// The unit price for a quantity. A product discount replaces the tiers: commercetools applies the discounted value.
export function unitPriceAt(price: Price, quantity: number): TypedMoney {
  if (price.discounted) return price.discounted.value;
  return priceSteps(price).findLast((s) => quantity >= s.minimumQuantity)!.value;
}

// The next quantity break above `quantity`, for "Buy 10 for $36.00 each" hints in the cart.
export function nextStep(price: Price, quantity: number): PriceStep | undefined {
  if (price.discounted) return undefined;
  return priceSteps(price).find((s) => s.minimumQuantity > quantity);
}

// The lowest unit price any quantity gets ("As low as").
export function lowestUnitPrice(price: Price): TypedMoney {
  if (price.discounted) return price.discounted.value;
  return priceSteps(price).reduce((low, s) => (s.value.centAmount < low.value.centAmount ? s : low)).value;
}

// Whole percent saved against the base price, rounded down so it never overstates the saving.
export const savingPercent = (base: TypedMoney, value: TypedMoney) =>
  Math.floor(((base.centAmount - value.centAmount) / base.centAmount) * 100);
