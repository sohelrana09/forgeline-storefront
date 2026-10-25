import type { TypedMoney } from "@commercetools/platform-sdk";

export function formatMoney(money: Pick<TypedMoney, "centAmount" | "currencyCode" | "fractionDigits">) {
  return new Intl.NumberFormat("en", { style: "currency", currency: money.currencyCode }).format(
    money.centAmount / 10 ** money.fractionDigits,
  );
}
