import type { BaseAddress, Order } from "@commercetools/platform-sdk";
import { localize } from "@/features/catalog/utils";
import { summarize } from "@/features/cart/summary";
import { formatMoney } from "@/lib/utils";
import { SELLER } from "@/lib/seller";
import { orderReference as orderRef } from "@/features/orders/utils";

// Order documents as plain data (pure, unit-tested); src/features/orders/pdf.ts draws them.
// commercetools issues no invoices: an invoice is offered once fulfilment confirmed the order (state Confirmed or
// Complete, set by the ERP or Merchant Center), never for a cancelled order or one waiting for (or refused) approval.

export type DocumentKind = "confirmation" | "invoice";
export const DOCUMENT_KINDS: DocumentKind[] = ["confirmation", "invoice"];

export function invoiceAvailable(order: Pick<Order, "orderState">, approvalStatus?: string): boolean {
  return (order.orderState === "Confirmed" || order.orderState === "Complete") && (!approvalStatus || approvalStatus === "Approved");
}

export const documentFilename = (kind: DocumentKind, order: Pick<Order, "orderNumber" | "id">) =>
  `${kind === "invoice" ? "invoice" : "order-confirmation"}-${orderRef(order).replace(/[^A-Za-z0-9_-]/g, "-")}.pdf`;

export type OrderDocument = {
  title: string;
  number: string;
  meta: [string, string][];
  seller: string[];
  billTo: string[];
  shipTo: string[];
  lines: { sku: string; name: string; quantity: string; unitPrice: string; total: string }[];
  totals: [string, string][];
  total: [string, string];
  notes: string[];
};

const addressLines = (a?: BaseAddress) =>
  a
    ? [
        a.company,
        [a.firstName, a.lastName].filter(Boolean).join(" "),
        [a.streetName, a.streetNumber].filter(Boolean).join(" "),
        [a.postalCode, a.city].filter(Boolean).join(" "),
        [a.state, a.country].filter(Boolean).join(", "),
      ].filter((l): l is string => Boolean(l))
    : [];

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

// `buyer`: the company name for business orders. `payment`: how the order is paid, as the order page says it. The
// invoice date is the order's completion (else its last change), so the same invoice always prints the same.
export function orderDocument(
  order: Order,
  kind: DocumentKind,
  { buyer, payment }: { buyer?: string; payment: "invoice" | "card" | "bank-transfer" },
): OrderDocument {
  const s = summarize(order);
  const money = (centAmount: number) => formatMoney({ centAmount, currencyCode: s.currency, fractionDigits: s.fractionDigits });
  const ref = orderRef(order);
  const invoice = kind === "invoice";
  const issued = order.completedAt ?? order.lastModifiedAt;
  const due = new Date(new Date(issued).getTime() + SELLER.paymentTermsDays * 24 * 60 * 60 * 1000).toISOString();

  const meta: [string, string][] = [
    ...(invoice
      ? ([
          ["Invoice number", `INV-${ref}`],
          ["Invoice date", day(issued)],
        ] as [string, string][])
      : []),
    ["Order number", ref],
    ["Order date", day(order.createdAt)],
    ...(order.purchaseOrderNumber ? ([["Purchase order", order.purchaseOrderNumber]] as [string, string][]) : []),
    ...(buyer ? ([["Customer", buyer]] as [string, string][]) : []),
    ...(invoice && payment === "invoice" ? ([["Due date", day(due)]] as [string, string][]) : []),
  ];

  const paymentNote =
    payment === "card"
      ? "Paid by card."
      : payment === "invoice"
        ? `Payment within ${SELLER.paymentTermsDays} days to ${SELLER.bank.name}, IBAN ${SELLER.bank.iban}, BIC ${SELLER.bank.bic}. Please quote ${invoice ? `INV-${ref}` : `order ${ref}`}.`
        : `Please pay by bank transfer to ${SELLER.bank.name}, IBAN ${SELLER.bank.iban}, BIC ${SELLER.bank.bic}, quoting order ${ref}.`;

  return {
    title: invoice ? "Invoice" : "Order confirmation",
    number: invoice ? `INV-${ref}` : ref,
    meta,
    seller: [SELLER.name, ...SELLER.address, `VAT ID ${SELLER.vatId}`, SELLER.email],
    billTo: addressLines(order.billingAddress ?? order.shippingAddress),
    shipTo: addressLines(order.shippingAddress),
    lines: order.lineItems.map((l) => ({
      sku: l.variant.sku ?? "",
      name: localize(l.name),
      quantity: String(l.quantity),
      unitPrice: formatMoney(l.price.discounted?.value ?? l.price.value),
      total: formatMoney(l.totalPrice),
    })),
    totals: [
      [`Items (${s.items})`, money(s.subtotal)],
      ...(s.shipping
        ? ([[`Shipping · ${s.shipping.name ?? ""}`.trim(), s.shipping.amount ? money(s.shipping.amount) : "Free"]] as [string, string][])
        : []),
      ...(s.taxes ?? []).map((t): [string, string] => [t.label, money(t.amount)]),
    ],
    total: ["Total", money(s.total)],
    notes: [
      paymentNote,
      ...(order.orderState === "Cancelled" ? ["This order was cancelled."] : []),
      ...(invoice ? [] : ["This is an order confirmation, not an invoice. The invoice follows once the order is confirmed."]),
    ],
  };
}
