import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { sanitizer } from "@/features/orders/pdf";
import { SELLER as seller } from "@/lib/seller";

// A one-page (or more) A4 spec sheet: name, SKU, specifications and description. No price, so it is the same for
// every visitor and can be cached publicly.
export type SpecSheet = { name: string; sku: string; specs: { name: string; value: string }[]; description: string; url: string };

const PAGE: [number, number] = [595.28, 841.89];
const MARGIN = 48;

export async function renderSpecSheet(sheet: SpecSheet): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${sheet.name} (${sheet.sku}) spec sheet`);
  pdf.setCreator(`${seller.name} storefront`);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean = sanitizer(regular);
  let page = pdf.addPage(PAGE);
  let y = PAGE[1] - MARGIN;
  const width = PAGE[0] - 2 * MARGIN;
  const ensure = (h: number) => {
    if (y - h < MARGIN) {
      page = pdf.addPage(PAGE);
      y = PAGE[1] - MARGIN;
    }
  };
  const line = (s: string, size = 10, font = regular, x = MARGIN, color = rgb(0.1, 0.1, 0.12)) => {
    ensure(size + 6);
    page.drawText(clean(s), { x, y, size, font, color });
  };
  // Word wrap to the width.
  const wrap = (s: string, max: number, size: number) => {
    const out: string[] = [];
    for (const para of clean(s).split(/\n+/)) {
      let current = "";
      for (const word of para.split(/\s+/)) {
        const next = current ? `${current} ${word}` : word;
        if (regular.widthOfTextAtSize(next, size) > max && current) {
          out.push(current);
          current = word;
        } else current = next;
      }
      if (current) out.push(current);
    }
    return out;
  };

  line(seller.name, 9, bold, MARGIN, rgb(0.76, 0.25, 0.05));
  y -= 24;
  for (const l of wrap(sheet.name, width, 18)) {
    line(l, 18, bold);
    y -= 22;
  }
  line(`SKU ${sheet.sku}`, 10, regular, MARGIN, rgb(0.42, 0.45, 0.5));
  y -= 28;
  if (sheet.specs.length) {
    line("Specifications", 12, bold);
    y -= 18;
    for (const s of sheet.specs) {
      const values = wrap(s.value, width * 0.6, 10);
      ensure(14 * values.length + 6);
      page.drawText(clean(s.name), { x: MARGIN, y, size: 10, font: bold });
      for (const v of values) {
        page.drawText(v, { x: MARGIN + width * 0.4, y, size: 10, font: regular });
        y -= 14;
      }
      page.drawLine({ start: { x: MARGIN, y: y + 8 }, end: { x: MARGIN + width, y: y + 8 }, thickness: 0.5, color: rgb(0.85, 0.86, 0.88) });
      y -= 4;
    }
    y -= 16;
  }
  if (sheet.description) {
    line("Description", 12, bold);
    y -= 18;
    for (const l of wrap(sheet.description.slice(0, 4000), width, 10)) {
      line(l);
      y -= 14;
    }
    y -= 12;
  }
  line(sheet.url, 8, regular, MARGIN, rgb(0.42, 0.45, 0.5));
  return pdf.save();
}
