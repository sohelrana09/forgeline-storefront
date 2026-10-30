import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { OrderDocument } from "@/features/orders/documents";

// Draws an order document (documents.ts) as an A4 PDF with the standard Helvetica fonts, page breaks with a repeated
// table header, and page numbers.

const PAGE: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const GRAY = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.85, 0.86, 0.88);
const ACCENT = rgb(0.76, 0.25, 0.05);

// The standard fonts only know Windows-1252: typographic spaces become plain ones, anything else unknown becomes "?".
function sanitizer(font: PDFFont) {
  const known = new Set(font.getCharacterSet());
  return (text: string) =>
    [...text.replace(/[  ]/g, " ").replace(/[‐‑]/g, "-")].map((ch) => (known.has(ch.codePointAt(0)!) ? ch : "?")).join("");
}

export async function renderOrderPdf(doc: OrderDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${doc.title} ${doc.number}`);
  pdf.setCreator("Ironline Supply storefront");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean = sanitizer(regular);

  let page: PDFPage = pdf.addPage(PAGE);
  let y = PAGE[1] - MARGIN;
  const width = PAGE[0] - 2 * MARGIN;

  const text = (s: string, x: number, size = 9, font = regular, color = rgb(0.1, 0.1, 0.12)) =>
    page.drawText(clean(s), { x, y, size, font, color });
  const right = (s: string, xRight: number, size = 9, font = regular) =>
    page.drawText(clean(s), { x: xRight - font.widthOfTextAtSize(clean(s), size), y, size, font });
  // Shortens a string to fit `max` points, with an ellipsis.
  const fit = (s: string, max: number, size = 9, font = regular) => {
    let out = clean(s);
    if (font.widthOfTextAtSize(out, size) <= max) return out;
    while (out.length > 1 && font.widthOfTextAtSize(`${out}...`, size) > max) out = out.slice(0, -1);
    return `${out}...`;
  };
  const rule = () => page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + width, y }, thickness: 0.6, color: LINE });

  // Header: seller on the left, document title and number on the right.
  text(doc.seller[0], MARGIN, 14, bold, ACCENT);
  right(doc.title, MARGIN + width, 18, bold);
  y -= 18;
  for (const line of doc.seller.slice(1)) {
    text(line, MARGIN, 8.5, regular, GRAY);
    y -= 11;
  }
  y -= 10;

  // Order facts, then the two addresses side by side.
  for (const [label, value] of doc.meta) {
    text(label, MARGIN, 9, regular, GRAY);
    text(value, MARGIN + 110, 9, bold);
    y -= 13;
  }
  y -= 10;
  const col2 = MARGIN + width / 2;
  text("Bill to", MARGIN, 9, bold);
  text("Ship to", col2, 9, bold);
  y -= 13;
  for (let i = 0; i < Math.max(doc.billTo.length, doc.shipTo.length); i++) {
    if (doc.billTo[i]) text(fit(doc.billTo[i], width / 2 - 12), MARGIN);
    if (doc.shipTo[i]) text(fit(doc.shipTo[i], width / 2 - 12), col2);
    y -= 12;
  }
  y -= 14;

  // Lines: SKU, product, quantity, unit price, total.
  const cols = { sku: MARGIN, name: MARGIN + 95, qty: MARGIN + width - 165, unit: MARGIN + width - 80, total: MARGIN + width };
  const tableHeader = () => {
    text("SKU", cols.sku, 8, bold, GRAY);
    text("Product", cols.name, 8, bold, GRAY);
    right("Qty", cols.qty, 8, bold);
    right("Unit price", cols.unit, 8, bold);
    right("Total", cols.total, 8, bold);
    y -= 6;
    rule();
    y -= 13;
  };
  const newPage = () => {
    page = pdf.addPage(PAGE);
    y = PAGE[1] - MARGIN;
    text(`${doc.title} ${doc.number} (continued)`, MARGIN, 9, bold, GRAY);
    y -= 22;
  };
  tableHeader();
  for (const l of doc.lines) {
    if (y < MARGIN + 40) {
      newPage();
      tableHeader();
    }
    text(fit(l.sku, cols.name - cols.sku - 8, 8.5), cols.sku, 8.5);
    text(fit(l.name, cols.qty - cols.name - 40), cols.name);
    right(l.quantity, cols.qty);
    right(l.unitPrice, cols.unit);
    right(l.total, cols.total);
    y -= 15;
  }
  y += 4;
  rule();
  y -= 16;

  // Totals, right-aligned, then the notes (payment details).
  if (y < MARGIN + 30 + 14 * (doc.totals.length + 1 + doc.notes.length)) newPage();
  for (const [label, value] of doc.totals) {
    right(label, cols.unit - 20, 9);
    right(value, cols.total, 9);
    y -= 14;
  }
  right(doc.total[0], cols.unit - 20, 11, bold);
  right(doc.total[1], cols.total, 11, bold);
  y -= 28;
  for (const note of doc.notes) {
    for (const line of wrap(clean(note), width, 8.5, regular)) {
      text(line, MARGIN, 8.5, regular, GRAY);
      y -= 11;
    }
    y -= 4;
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: PAGE[0] - MARGIN - regular.widthOfTextAtSize(label, 8), y: MARGIN / 2, size: 8, font: regular, color: GRAY });
  });
  return pdf.save();
}

function wrap(s: string, max: number, size: number, font: PDFFont): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of s.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
