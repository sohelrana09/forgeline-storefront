import type { Price } from "@commercetools/platform-sdk";
import { formatMoney } from "@/lib/utils";

export function PriceTag({ price, note, size = "md" }: { price?: Price; note?: string; size?: "md" | "lg" }) {
  if (!price) return <span className="text-sm text-gray-500">No price</span>;
  const big = size === "lg" ? "text-2xl" : "text-base";
  return (
    <div>
      {price.discounted ? (
        <span className="flex flex-wrap items-baseline gap-2">
          <span className={`${big} font-bold text-red-700`}>{formatMoney(price.discounted.value)}</span>
          <span className="text-sm text-gray-500 line-through">{formatMoney(price.value)}</span>
        </span>
      ) : (
        <span className={`${big} font-bold`}>{formatMoney(price.value)}</span>
      )}
      {note && <span className="block text-xs text-gray-500">{note}</span>}
    </div>
  );
}
