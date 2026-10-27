// Parses pasted quick-order text: one "SKU, qty" per line (comma, tab, semicolon or spaces).
// Duplicate SKUs are merged; bad lines are reported with their line number.

import type { QuickOrderError, QuickOrderLine } from "@/features/quick-order/types";

export const MAX_LINES = 100;
const MAX_QUANTITY = 9999;

export function parseQuickOrder(input: string): { lines: QuickOrderLine[]; errors: QuickOrderError[] } {
  const merged = new Map<string, number>();
  const errors: QuickOrderError[] = [];

  input.split(/\r?\n/).forEach((raw, i) => {
    const text = raw.trim();
    if (!text) return;
    const line = i + 1;

    const [sku, qtyText = "1", ...rest] = text.split(/\s*[,;\t]\s*|\s+/);
    if (rest.length > 0) {
      errors.push({ line, text, reason: 'Expected "SKU, quantity"' });
      return;
    }
    if (!/^[A-Za-z0-9._-]+$/.test(sku)) {
      errors.push({ line, text, reason: "SKU may only contain letters, digits, . _ -" });
      return;
    }
    const quantity = Number(qtyText);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      errors.push({ line, text, reason: `Quantity must be a whole number from 1 to ${MAX_QUANTITY}` });
      return;
    }
    merged.set(sku, (merged.get(sku) ?? 0) + quantity);
  });

  // Each line was in range, but lines for the same SKU add up.
  for (const [sku, quantity] of merged) {
    if (quantity <= MAX_QUANTITY) continue;
    errors.push({ line: 0, text: `${sku}, ${quantity}`, reason: `Quantity must be a whole number from 1 to ${MAX_QUANTITY}` });
    merged.delete(sku);
  }

  const lines = [...merged].map(([sku, quantity]) => ({ sku, quantity }));
  if (lines.length > MAX_LINES) {
    errors.push({ line: 0, text: "", reason: `At most ${MAX_LINES} different SKUs per quick order` });
    return { lines: lines.slice(0, MAX_LINES), errors };
  }
  return { lines, errors };
}
