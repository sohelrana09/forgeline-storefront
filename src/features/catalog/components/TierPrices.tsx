import type { Price } from "@commercetools/platform-sdk";
import { formatMoney } from "@/lib/utils";
import { priceSteps, savingPercent } from "@/features/catalog/tiers";

// Quantity breaks under the price on the product page: "Buy 10 for $36.00 each and save 10%". Nothing without tiers,
// or while a product discount applies (it replaces the tiers).
export function TierPrices({ price }: { price?: Price }) {
  if (!price || price.discounted) return null;
  const [base, ...tiers] = priceSteps(price);
  if (tiers.length === 0) return null;
  return (
    <ul aria-label="Quantity discounts" className="m-0 flex list-none flex-col gap-1 rounded-md bg-gray-50 p-3 text-sm">
      {tiers.map((t) => (
        <li key={t.minimumQuantity}>
          Buy {t.minimumQuantity} for <strong>{formatMoney(t.value)}</strong> each and{" "}
          <strong className="text-green-800">save {savingPercent(base.value, t.value)}%</strong>
        </li>
      ))}
    </ul>
  );
}
