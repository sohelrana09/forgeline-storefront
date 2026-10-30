import { describe, expect, it, vi } from "vitest";
import type { Order } from "@commercetools/platform-sdk";
import { PDFDocument } from "pdf-lib";
import { documentFilename, invoiceAvailable, orderDocument } from "@/features/orders/documents";

vi.mock("server-only", () => ({}));
const { renderOrderPdf } = await import("@/features/orders/pdf");

const eur = (centAmount: number) => ({ type: "centPrecision" as const, currencyCode: "EUR", centAmount, fractionDigits: 2 });
const line = (i: number, quantity = 2, price = 4000) => ({
  id: `l${i}`,
  name: { "en-US": `Part ${i}` },
  variant: { id: 1, sku: `part-${i}` },
  quantity,
  price: { id: "p", value: eur(price) },
  totalPrice: eur(price * quantity),
  taxRate: { name: "VAT", amount: 0.21, includedInPrice: true, country: "ES" },
});
const order = (over: Partial<Order> = {}) =>
  ({
    id: "098d3a1f-1111-2222-3333-444455556666",
    orderNumber: "ES-1001",
    createdAt: "2026-10-01T10:00:00Z",
    lastModifiedAt: "2026-10-02T10:00:00Z",
    orderState: "Open",
    purchaseOrderNumber: "PO-77",
    lineItems: [line(1)],
    totalPrice: eur(8000),
    taxedPrice: { totalNet: eur(6612), totalGross: eur(8000), taxPortions: [{ rate: 0.21, amount: eur(1388), name: "VAT" }] },
    shippingAddress: { country: "ES", company: "LiftTech Soluciones S.L.", streetName: "Calle Mayor", streetNumber: "101", city: "Madrid" },
    businessUnit: { typeId: "business-unit", key: "lifttech-solutions-ltd-es" },
    ...over,
  }) as unknown as Order;

describe("invoiceAvailable", () => {
  it("needs a confirmed or completed order", () => {
    expect(invoiceAvailable({ orderState: "Open" })).toBe(false);
    expect(invoiceAvailable({ orderState: "Cancelled" })).toBe(false);
    expect(invoiceAvailable({ orderState: "Confirmed" })).toBe(true);
    expect(invoiceAvailable({ orderState: "Complete" })).toBe(true);
  });

  it("waits for an approval and never follows a rejection", () => {
    expect(invoiceAvailable({ orderState: "Confirmed" }, "Pending")).toBe(false);
    expect(invoiceAvailable({ orderState: "Confirmed" }, "Rejected")).toBe(false);
    expect(invoiceAvailable({ orderState: "Confirmed" }, "Approved")).toBe(true);
  });
});

describe("documentFilename", () => {
  it("names the file after the document and a safe order reference", () => {
    expect(documentFilename("invoice", { orderNumber: "ES/1001", id: "x" })).toBe("invoice-ES-1001.pdf");
    expect(documentFilename("confirmation", { id: "098d3a1f-0000" })).toBe("order-confirmation-098D3A1F.pdf");
  });
});

describe("orderDocument", () => {
  it("describes an order confirmation", () => {
    const doc = orderDocument(order(), "confirmation", { buyer: "LiftTech Soluciones S.L.", payment: "invoice" });
    expect(doc.title).toBe("Order confirmation");
    expect(doc.number).toBe("ES-1001");
    expect(Object.fromEntries(doc.meta)).toMatchObject({
      "Order number": "ES-1001",
      "Purchase order": "PO-77",
      Customer: "LiftTech Soluciones S.L.",
    });
    expect(doc.lines[0]).toEqual({ sku: "part-1", name: "Part 1", quantity: "2", unitPrice: "€40.00", total: "€80.00" });
    expect(doc.totals.map(([l]) => l)).toEqual(["Items (2)", "incl. VAT 21%"]);
    expect(doc.total).toEqual(["Total", "€80.00"]);
    expect(doc.notes.at(-1)).toMatch(/not an invoice/);
  });

  it("adds the invoice number, dates and payment terms to an invoice", () => {
    const doc = orderDocument(order({ orderState: "Confirmed" }), "invoice", { payment: "invoice" });
    const meta = Object.fromEntries(doc.meta);
    expect(doc.number).toBe("INV-ES-1001");
    expect(meta["Invoice date"]).toBe("02 Oct 2026");
    expect(meta["Due date"]).toBe("01 Nov 2026");
    expect(doc.notes[0]).toMatch(/Payment within 30 days .* INV-ES-1001/);
  });

  it("says a card payment is paid and has no due date", () => {
    const doc = orderDocument(order({ orderState: "Complete" }), "invoice", { payment: "card" });
    expect(Object.fromEntries(doc.meta)["Due date"]).toBeUndefined();
    expect(doc.notes[0]).toBe("Paid by card.");
  });
});

describe("renderOrderPdf", () => {
  it("draws a PDF, breaking long orders onto more pages", async () => {
    const many = order({ lineItems: Array.from({ length: 80 }, (_, i) => line(i)) as unknown as Order["lineItems"] });
    const bytes = await renderOrderPdf(orderDocument(many, "confirmation", { payment: "invoice" }));
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });

  it("survives characters the standard fonts don't have", async () => {
    const odd = order({ shippingAddress: { country: "PL", company: "Łódź Żuraw Sp. z o.o.", city: "東京" } as Order["shippingAddress"] });
    const bytes = await renderOrderPdf(orderDocument(odd, "confirmation", { payment: "bank-transfer" }));
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
