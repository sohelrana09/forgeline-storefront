import { describe, expect, it } from "vitest";
import type { OrderDocument } from "@/features/orders/documents";
import { confirmationEmail } from "@/features/order-processing/email";

const doc: OrderDocument = {
  title: "Order confirmation",
  number: "ORD-2026-000001",
  meta: [
    ["Order number", "ORD-2026-000001"],
    ["Order date", "06 Nov 2026"],
    ["Purchase order", "PO-4711"],
  ],
  seller: ["Ironline Supply Ltd", "Industriestraße 12", "10115 Berlin", "Germany", "VAT ID DE000000000", "accounts@example.com"],
  billTo: [],
  shipTo: ["Test Tester", "Teststrasse 1", "10115 Berlin", "DE"],
  lines: [{ sku: "air-filter", name: "Air Filter", quantity: "1", unitPrice: "€40.00", total: "€40.00" }],
  totals: [
    ["Items (1)", "€40.00"],
    ["Shipping · Standard", "€100.00"],
  ],
  total: ["Total", "€140.00"],
  notes: [
    "Please pay by bank transfer to Example Bank, quoting order ORD-2026-000001.",
    "This is an order confirmation, not an invoice. The invoice follows once the order is confirmed.",
  ],
};

describe("confirmationEmail", () => {
  it("summarises the order for a guest, without an account link", () => {
    const mail = confirmationEmail(doc, { to: "guest@example.com" });
    expect(mail.to).toBe("guest@example.com");
    expect(mail.subject).toBe("Your order ORD-2026-000001");
    expect(mail.text).toContain("Thank you for your order ORD-2026-000001.");
    expect(mail.text).toContain("Purchase order  PO-4711");
    expect(mail.text).toContain("1 x Air Filter (air-filter)  €40.00");
    expect(mail.text).toContain("Total                €140.00");
    expect(mail.text).toContain("Teststrasse 1");
    expect(mail.text).toContain("Please pay by bank transfer");
    expect(mail.text).not.toContain("not an invoice");
    expect(mail.text).not.toContain("View your order");
    expect(mail.text).not.toContain("approval");
    expect(mail.text.endsWith("Ironline Supply Ltd\naccounts@example.com")).toBe(true);
  });

  it("links signed-in buyers to the order and mentions approvals for business orders", () => {
    const mail = confirmationEmail(doc, { to: "b@example.com", orderUrl: "https://shop.example/account/orders/1", business: true });
    expect(mail.text).toContain("View your order: https://shop.example/account/orders/1");
    expect(mail.text).toContain("processed once it is approved");
  });
});
