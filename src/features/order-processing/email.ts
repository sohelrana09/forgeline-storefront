import type { Mail } from "@/lib/mailer";
import type { OrderDocument } from "@/features/orders/documents";

// The order confirmation email (G2), as plain text, from the same data as the confirmation PDF (orderDocument), so
// the email, the PDF and the order page agree. Pure, unit-tested; the confirmation step in service.ts sends it.

export type ConfirmationOptions = {
  to: string;
  // Link to the order in the account (signed-in buyers). Guests have no account page: their email is their record.
  orderUrl?: string;
  // Business orders may wait for the company's approval before they are processed.
  business?: boolean;
};

const table = (rows: [string, string][]) => {
  const width = Math.max(0, ...rows.map(([label]) => label.length));
  return rows.map(([label, value]) => `${label.padEnd(width)}  ${value}`);
};

export function confirmationEmail(doc: OrderDocument, { to, orderUrl, business }: ConfirmationOptions): Mail {
  const lines = doc.lines.map((l) => `${l.quantity} x ${l.name}${l.sku ? ` (${l.sku})` : ""}  ${l.total}`);
  const text = [
    `Thank you for your order ${doc.number}.`,
    "",
    ...table(doc.meta),
    "",
    "Items",
    ...lines,
    "",
    ...table([...doc.totals, doc.total]),
    "",
    "Delivery address",
    ...doc.shipTo,
    "",
    "Payment",
    ...doc.notes.filter((n) => !n.startsWith("This is an order confirmation")),
    ...(business
      ? ["", "If your company's approval rules require it, the order is processed once it is approved. We'll email you the decision."]
      : []),
    ...(orderUrl ? ["", `View your order: ${orderUrl}`] : []),
    "",
    ...doc.seller.slice(0, 1),
    ...doc.seller.slice(-1),
  ].join("\n");
  return { to, subject: `Your order ${doc.number}`, text };
}
