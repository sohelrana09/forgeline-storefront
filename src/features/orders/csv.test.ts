import { describe, expect, it } from "vitest";
import type { Order } from "@commercetools/platform-sdk";
import { csvCell, ordersCsv } from "@/features/orders/csv";

const eur = (centAmount: number) => ({ type: "centPrecision" as const, currencyCode: "EUR", centAmount, fractionDigits: 2 });
const order = (over: Partial<Order> = {}) =>
  ({
    id: "098d3a1f-0000",
    orderNumber: "ES-1",
    createdAt: "2026-10-25T09:00:00Z",
    customerId: "c1",
    orderState: "Open",
    purchaseOrderNumber: "PO 7",
    lineItems: [{ quantity: 3 }, { quantity: 2 }],
    totalPrice: eur(12100),
    taxedPrice: { totalNet: eur(10000), totalGross: eur(12100), taxPortions: [] },
    ...over,
  }) as unknown as Order;

describe("csvCell", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(undefined)).toBe("");
  });

  it("keeps text that looks like a formula from running", () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell(-5)).toBe("'-5");
  });
});

describe("ordersCsv", () => {
  it("writes one row per order with plain decimal amounts", () => {
    const lines = ordersCsv([order()]).replace("﻿", "").trim().split("\r\n");
    expect(lines[0]).toBe("Order,Date,Purchase order,Status,Items,Net,Tax,Total,Currency");
    expect(lines[1]).toBe("ES-1,2026-10-25,PO 7,Open,5,100.00,21.00,121.00,EUR");
  });

  it("adds who placed each order for company exports", () => {
    const csv = ordersCsv([order(), order({ customerId: "gone", customerEmail: "x@y.z" })], { c1: "Sofía López" });
    const [, first, second] = csv.trim().split("\r\n");
    expect(first).toContain(",Sofía López,");
    expect(second).toContain(",x@y.z,");
  });

  it("starts with a byte-order mark for Excel", () => expect(ordersCsv([]).startsWith("﻿")).toBe(true));
});
