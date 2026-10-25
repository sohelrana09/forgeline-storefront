import type { TypedMoney } from "@commercetools/platform-sdk";

// A query parameter repeated in the URL (?q=a&q=b) arrives as an array: use the first value.
export const firstParam = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

export function formatMoney(money: Pick<TypedMoney, "centAmount" | "currencyCode" | "fractionDigits">) {
  return new Intl.NumberFormat("en", { style: "currency", currency: money.currencyCode }).format(
    money.centAmount / 10 ** money.fractionDigits,
  );
}
