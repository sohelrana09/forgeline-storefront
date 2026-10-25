import type { Cart, Order, Quote, QuoteRequest } from "@commercetools/platform-sdk";
import { formatMoney } from "@/lib/utils";

// Subtotal, shipping, tax and total for a cart, order, quote request or quote (same shape on all four).
export function CartSummary({ cart, title = "Summary" }: { cart: Cart | Order | Quote | QuoteRequest; title?: string }) {
  const currency = cart.totalPrice.currencyCode;
  const fd = cart.totalPrice.fractionDigits;
  const money = (centAmount: number) => formatMoney({ centAmount, currencyCode: currency, fractionDigits: fd });
  const taxIncluded = cart.lineItems.some((l) => l.taxRate?.includedInPrice);
  const subtotal = cart.lineItems.reduce((sum, l) => sum + l.totalPrice.centAmount, 0);
  // Show shipping on the same basis as the lines (EU: gross, US: net + tax rows), so the rows add up to the total.
  const shippingTaxed = cart.shippingInfo?.taxedPrice;
  const shipping = (taxIncluded ? shippingTaxed?.totalGross : shippingTaxed?.totalNet)?.centAmount ?? cart.shippingInfo?.price.centAmount;
  const taxed = cart.taxedPrice;

  return (
    <section aria-label={title} className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-5 text-sm">
      <h2 className="m-0 mb-1 text-lg font-semibold">{title}</h2>
      <Row label={`Items (${cart.lineItems.reduce((n, l) => n + l.quantity, 0)})`} value={money(subtotal)} />
      <Row
        label={cart.shippingInfo ? `Shipping · ${cart.shippingInfo.shippingMethodName}` : "Shipping"}
        value={shipping === undefined ? "Chosen at checkout" : shipping === 0 ? "Free" : money(shipping)}
      />
      {taxed?.taxPortions.map((t, i) => (
        <Row
          key={i}
          label={`${taxIncluded ? "incl. " : ""}${t.name ?? "Tax"} ${Math.round(t.rate * 1000) / 10}%`}
          value={formatMoney(t.amount)}
          muted={taxIncluded}
        />
      ))}
      {!taxed && <Row label="Tax" value="Calculated with a delivery address" muted />}
      <div className="mt-2 flex items-baseline justify-between border-t border-gray-200 pt-3">
        <span className="font-semibold">Total</span>
        <span className="text-xl font-bold">{formatMoney(taxed?.totalGross ?? cart.totalPrice)}</span>
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
