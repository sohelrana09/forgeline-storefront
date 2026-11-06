import type { DiscountCodeState } from "@commercetools/platform-sdk";

// Discount codes in the cart (G7). The buyer's own token adds and removes them (addDiscountCode / removeDiscountCode
// are My Cart actions); commercetools then reports per code whether it applies (DiscountCodeState). Pure, unit-tested.

// What a buyer can type: letters, digits, - and _, up to 64 characters (stray spaces dropped). Anything else is
// refused before it reaches commercetools.
export function normalizeCode(input: string): string | undefined {
  const code = input.trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(code) ? code : undefined;
}

// "applied": the code takes effect now. "kept": valid and in the cart, but it doesn't change the total right now.
export function discountStateMessage(code: string, state: DiscountCodeState | undefined): { ok: boolean; text: string } {
  switch (state) {
    case "MatchesCart":
      return { ok: true, text: `Discount code ${code} applied.` };
    case "DoesNotMatchCart":
      return { ok: true, text: `Discount code ${code} is saved, but none of the items in your cart qualify for it yet.` };
    case "MaxApplicationReached":
      return { ok: false, text: `Discount code ${code} has been used the maximum number of times.` };
    case "NotActive":
    case "NotValid":
      return { ok: false, text: `Discount code ${code} isn't valid at the moment.` };
    case "ApplicationStoppedByPreviousDiscount":
    case "ApplicationStoppedByGroupBestDeal":
      return { ok: false, text: `Discount code ${code} can't be combined with a discount your cart already has.` };
    default:
      return { ok: false, text: `Discount code ${code} could not be applied.` };
  }
}

// Short status for a code listed in the cart.
export const discountStateLabel = (state: DiscountCodeState) =>
  state === "MatchesCart" ? "Applied" : state === "DoesNotMatchCart" ? "No qualifying items" : "Not applied";

type ErrorBody = { body?: { errors?: { code?: string; reason?: string }[] } };

// The message for commercetools refusing a code (DiscountCodeNonApplicable), or undefined for any other error.
export function nonApplicableMessage(code: string, err: unknown): string | undefined {
  const e = (err as ErrorBody)?.body?.errors?.find((x) => x.code === "DiscountCodeNonApplicable");
  if (!e) return undefined;
  if (e.reason === "TimeRangeNonApplicable") return `Discount code ${code} isn't valid at the moment.`;
  // DoesNotExist and anything else: don't tell apart unknown codes from inactive ones.
  return `We don't recognise the discount code ${code}.`;
}
