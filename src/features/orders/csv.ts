import type { Order } from "@commercetools/platform-sdk";
import { orderReference } from "@/features/orders/utils";
import { readProcurement } from "@/features/checkout/procurement";

// Order history as CSV (pure, unit-tested). Amounts are plain decimals so spreadsheets can add them up.

// A cell starting with = + - @ (also after spaces, or a tab/return/line feed) runs as a formula in Excel and Sheets: such text gets a leading
// apostrophe, which spreadsheets show as plain text.
export function csvCell(value: string | number | undefined): string {
  const s = value === undefined ? "" : String(value);
  const safe = /^(\s*[=+\-@]|[\t\r\n])/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const decimal = (m?: { centAmount: number; fractionDigits: number }) =>
  m ? (m.centAmount / 10 ** m.fractionDigits).toFixed(m.fractionDigits) : "";

// `names`: customer id → name, for company exports (who placed each order).
export function ordersCsv(orders: Order[], names?: Record<string, string>): string {
  const header = [
    "Order",
    "Date",
    ...(names ? ["Placed by"] : []),
    "Purchase order",
    "Status",
    "Items",
    "Net",
    "Tax",
    "Total",
    "Currency",
    "Cost centre",
    "Project code",
    "Requested delivery",
    "Order note",
  ];
  const rows = orders.map((o) => {
    const gross = o.taxedPrice?.totalGross ?? o.totalPrice;
    const net = o.taxedPrice?.totalNet;
    const p = readProcurement(o.custom);
    const tax = o.taxedPrice && { centAmount: gross.centAmount - o.taxedPrice.totalNet.centAmount, fractionDigits: gross.fractionDigits };
    return [
      orderReference(o),
      o.createdAt.slice(0, 10),
      ...(names ? [(o.customerId && names[o.customerId]) || o.customerEmail || ""] : []),
      o.purchaseOrderNumber,
      o.orderState,
      o.lineItems.reduce((n, l) => n + l.quantity, 0),
      decimal(net),
      decimal(tax),
      decimal(gross),
      gross.currencyCode,
      p.costCentre,
      p.projectCode,
      p.requestedDeliveryDate,
      p.orderNote,
    ];
  });
  // CRLF and a byte-order mark: Excel then opens UTF-8 names (Sofía) correctly.
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
