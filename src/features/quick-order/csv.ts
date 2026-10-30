// Turns an uploaded spreadsheet (CSV, saved from Excel, Google Sheets or an ERP export) into quick-order lines
// ("SKU, quantity", one per line) for the quick-order box, where parseQuickOrder validates them as if they were typed.
// Handles a byte-order mark, comma, semicolon (Excel in many European locales) or tab separators, quoted fields
// ("a, b" and "" for a quote) and extra columns (name, price, ...): with a header row the SKU and quantity columns are
// found by name, without one they are the first two columns.

export type CsvLines = {
  // "sku, quantity" lines, ready for the quick-order box.
  lines: string[];
  // Rows that had no SKU (blank or a total line), for the summary.
  skipped: number;
  // Which columns were used, for the summary ("SKU", "Qty"), or undefined without a header row.
  columns?: { sku: string; quantity?: string };
};

const SKU_HEADER = /^(sku|article|article ?(no|number|#)|item|item ?(no|number|#|code)|part|part ?(no|number|#)|product ?code|code)$/i;
const QUANTITY_HEADER = /^(qty|quantity|quantities|amount|count|units|pcs|pieces|order ?qty)$/i;

// The separator used most in the first line that has one.
function separatorOf(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  let best = ",";
  let most = 0;
  for (const sep of [",", ";", "\t"]) {
    const count = first.split(sep).length - 1;
    if (count > most) [best, most] = [sep, count];
  }
  return best;
}

// RFC 4180-style rows: quoted fields may hold separators, quotes ("") and line breaks.
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^﻿/, "");
  const sep = separatorOf(input);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((f) => f.trim())).filter((r) => r.some((f) => f !== ""));
}

export function csvToLines(text: string): CsvLines {
  const rows = parseCsv(text);
  if (rows.length === 0) return { lines: [], skipped: 0 };

  const header = rows[0];
  const skuColumn = header.findIndex((h) => SKU_HEADER.test(h));
  const hasHeader = skuColumn >= 0;
  const quantityColumn = hasHeader ? header.findIndex((h) => QUANTITY_HEADER.test(h)) : 1;
  const sku = hasHeader ? skuColumn : 0;

  let skipped = 0;
  const lines: string[] = [];
  for (const row of hasHeader ? rows.slice(1) : rows) {
    const code = row[sku]?.trim();
    if (!code) {
      skipped++;
      continue;
    }
    // A missing quantity column or cell means 1, as in the box; "12.0" (a spreadsheet's number format) is 12.
    const raw = quantityColumn >= 0 ? row[quantityColumn]?.trim() : "";
    const quantity = raw ? raw.replace(/^(\d+)[.,]0+$/, "$1") : "1";
    lines.push(`${code}, ${quantity}`);
  }
  return {
    lines,
    skipped,
    columns: hasHeader ? { sku: header[sku], quantity: quantityColumn >= 0 ? header[quantityColumn] : undefined } : undefined,
  };
}
