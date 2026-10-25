import type { LineItem } from "@commercetools/platform-sdk";
import { localize } from "@/features/catalog/utils";
import { formatMoney } from "@/lib/utils";

// Read-only lines of a quote request or quote, with the quoted unit price.
export function LineItemsList({ lines }: { lines: LineItem[] }) {
  return (
    <ul className="m-0 list-none p-0">
      {lines.map((line) => {
        const unit = line.price.discounted?.value ?? line.price.value;
        return (
          <li key={line.id} className="flex items-center justify-between gap-4 border-b border-gray-100 p-4 last:border-b-0">
            <div className="min-w-0">
              <div className="font-semibold">{localize(line.name)}</div>
              <div className="font-mono text-xs text-gray-600">
                {line.variant.sku} · qty {line.quantity} · {formatMoney(unit)} each
              </div>
            </div>
            <div className="font-semibold">{formatMoney(line.totalPrice)}</div>
          </li>
        );
      })}
    </ul>
  );
}
