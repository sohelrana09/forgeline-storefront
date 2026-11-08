import { z } from "zod";
import { MAX_QUANTITY } from "@/features/quick-order/parser";

// Purchase order to cart (docs/features/ai-po-to-cart.md), pure and unit-tested. A buyer pastes a purchase order's
// text or uploads its PDF; Claude reads the product lines out of it (service.ts); the lines become ordinary quick-order
// text ("SKU, quantity" per line) in the quick-order box, where the buyer checks them and adds them with the usual
// button, through the usual parser and unknown-SKU reporting. Nothing is added to a cart by the extraction itself.

export const poImportEnabled = () => process.env.AI_PO_TO_CART === "true" && Boolean(process.env.ANTHROPIC_API_KEY);

// Limits: a purchase order is a page or a few; anything bigger is not what this is for, and costs tokens.
export const MAX_TEXT_CHARS = 20_000;
export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_LINES = 200;

// What Claude returns (structured output, validated by the SDK against this schema).
export const extractionSchema = z.object({
  lines: z
    .array(
      z.object({
        sku: z.string().describe("The supplier's part number or SKU exactly as written on the order"),
        quantity: z.number().int().describe("Ordered quantity as a whole number"),
        description: z.string().describe("The line's description as written, or an empty string"),
      }),
    )
    .describe("Every ordered product line, in document order"),
  unreadable: z.array(z.string()).describe("Lines that look like ordered items but have no readable part number or quantity"),
});
export type Extraction = z.infer<typeof extractionSchema>;

export type PoInput = { kind: "text"; text: string } | { kind: "pdf"; data: Uint8Array };

// The upload as a PDF, or why not: size and the PDF signature (the browser's type claim is not trusted).
export function checkPdf(bytes: Uint8Array): string | undefined {
  if (bytes.byteLength === 0) return "The file is empty.";
  if (bytes.byteLength > MAX_PDF_BYTES) return "The PDF is larger than 5 MB.";
  const head = new TextDecoder().decode(bytes.subarray(0, 5));
  if (head !== "%PDF-") return "That file isn't a PDF. Upload the purchase order as a PDF, or paste its text.";
  return undefined;
}

export function checkText(text: string): string | undefined {
  if (!text.trim()) return "Paste the purchase order's text or upload its PDF.";
  if (text.length > MAX_TEXT_CHARS) return `The text is longer than ${MAX_TEXT_CHARS.toLocaleString("en")} characters.`;
  return undefined;
}

const SKU = /^[A-Za-z0-9._-]{1,64}$/;

export type PoResult = {
  // Quick-order text for the box: one "SKU, quantity" per line.
  text: string;
  count: number;
  // Lines left out, with why (the buyer sees them and can type them in).
  skipped: string[];
};

// Claude's lines → quick-order text. Only values the quick-order parser accepts get through; everything else is
// reported, never silently dropped. Spaces inside a part number ("AF 100") are removed, as buyers type them.
export function toQuickOrder(extraction: Extraction): PoResult {
  const out: string[] = [];
  const skipped = extraction.unreadable.slice(0, 20).map((u) => `${u.slice(0, 120)}: no part number or quantity`);
  for (const line of extraction.lines) {
    if (out.length >= MAX_LINES) {
      skipped.push(`More than ${MAX_LINES} lines: the rest were left out`);
      break;
    }
    const sku = line.sku.trim().replace(/\s+/g, "");
    const label = (line.description || line.sku).slice(0, 120);
    if (!SKU.test(sku)) skipped.push(`${label}: "${line.sku.slice(0, 64)}" isn't a part number the shop can read`);
    else if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY)
      skipped.push(`${label}: quantity ${line.quantity} is outside 1 to ${MAX_QUANTITY}`);
    else out.push(`${sku}, ${line.quantity}`);
  }
  return { text: out.join("\n"), count: out.length, skipped };
}
