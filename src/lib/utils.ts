import type { TypedMoney } from "@commercetools/platform-sdk";

// A query parameter repeated in the URL (?q=a&q=b) arrives as an array: use the first value.
export const firstParam = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

// High-precision money (SAP unit prices such as 0.386559) carries `preciseAmount` at `fractionDigits`, while its
// `centAmount` is rounded to the currency's own decimals: show the precise amount, up to 4 decimals.
export function formatMoney(money: Pick<TypedMoney, "centAmount" | "currencyCode" | "fractionDigits"> & { preciseAmount?: number }) {
  if (money.preciseAmount !== undefined)
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: money.currencyCode,
      maximumFractionDigits: Math.min(Math.max(money.fractionDigits, 2), 4),
    }).format(money.preciseAmount / 10 ** money.fractionDigits);
  return new Intl.NumberFormat("en", { style: "currency", currency: money.currencyCode }).format(
    money.centAmount / 10 ** money.fractionDigits,
  );
}

// Whether a timestamp is less than `ms` old (for "just placed" notes; Server Components render once per request).
export const isRecent = (iso: string, ms: number) => Date.now() - new Date(iso).getTime() < ms;
