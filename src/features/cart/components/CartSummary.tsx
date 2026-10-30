import type { Cart, Order, Quote, QuoteRequest } from "@commercetools/platform-sdk";
import { formatMoney } from "@/lib/utils";
import { summarize } from "@/features/cart/summary";

// Subtotal, shipping, tax and total for a cart, order, quote request or quote (same shape on all four).
export function CartSummary({ cart, title = "Summary" }: { cart: Cart | Order | Quote | QuoteRequest; title?: string }) {
  const s = summarize(cart);
  const money = (centAmount: number) => formatMoney({ centAmount, currencyCode: s.currency, fractionDigits: s.fractionDigits });

  return (
    <section aria-label={title} className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-5 text-sm">
      <h2 className="m-0 mb-1 text-lg font-semibold">{title}</h2>
      <Row label={`Items (${s.items})`} value={money(s.subtotal)} />
      <Row
        label={s.shipping ? `Shipping · ${s.shipping.name}` : "Shipping"}
        value={s.shipping?.amount === undefined ? "Chosen at checkout" : s.shipping.amount === 0 ? "Free" : money(s.shipping.amount)}
      />
      {s.taxes?.map((t, i) => (
        <Row key={i} label={t.label} value={money(t.amount)} muted={s.taxIncluded} />
      ))}
      {!s.taxes && <Row label="Tax" value="Calculated with a delivery address" muted />}
      <div className="mt-2 flex items-baseline justify-between border-t border-gray-200 pt-3">
        <span className="font-semibold">Total</span>
        <span className="text-xl font-bold">{money(s.total)}</span>
      </div>
    </section>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${muted ? "text-gray-600" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
