import { describe, expect, it } from "vitest";
import { checkPdf, checkText, MAX_LINES, MAX_PDF_BYTES, MAX_TEXT_CHARS, toQuickOrder } from "./po";
import { parseQuickOrder } from "@/features/quick-order/parser";

const enc = (s: string) => new TextEncoder().encode(s);

describe("checkPdf", () => {
  it("accepts a PDF by its signature, not its name or type", () => {
    expect(checkPdf(enc("%PDF-1.7\n..."))).toBeUndefined();
    expect(checkPdf(enc("<html>not a pdf"))).toMatch(/isn't a PDF/);
    expect(checkPdf(new Uint8Array())).toMatch(/empty/);
  });

  it("refuses files over 5 MB", () => {
    const big = new Uint8Array(MAX_PDF_BYTES + 1);
    big.set(enc("%PDF-"));
    expect(checkPdf(big)).toMatch(/5 MB/);
  });
});

describe("checkText", () => {
  it("needs some text and caps its length", () => {
    expect(checkText("  \n")).toMatch(/Paste/);
    expect(checkText("x".repeat(MAX_TEXT_CHARS + 1))).toMatch(/longer than/);
    expect(checkText("AF-100 x 4")).toBeUndefined();
  });
});

describe("toQuickOrder", () => {
  it("turns the lines into quick-order text the parser reads back", () => {
    const out = toQuickOrder({
      lines: [
        { sku: "air-filter", quantity: 24, description: "Air filter" },
        { sku: " OIL FILTER ", quantity: 6, description: "" },
      ],
      unreadable: [],
    });
    expect(out.text).toBe("air-filter, 24\nOILFILTER, 6");
    expect(out.count).toBe(2);
    expect(parseQuickOrder(out.text).lines).toEqual([
      { sku: "air-filter", quantity: 24 },
      { sku: "OILFILTER", quantity: 6 },
    ]);
  });

  it("reports what it leaves out instead of dropping it", () => {
    const out = toQuickOrder({
      lines: [
        { sku: "ok-1", quantity: 1, description: "" },
        { sku: "bad;sku", quantity: 1, description: "Semicolon part" },
        { sku: "ok-2", quantity: 0, description: "Zero" },
        { sku: "ok-3", quantity: 100000, description: "" },
        { sku: "ok-4", quantity: 2.5, description: "Half" },
      ],
      unreadable: ["Freight insurance, see note"],
    });
    expect(out.text).toBe("ok-1, 1");
    expect(out.skipped).toEqual([
      "Freight insurance, see note: no part number or quantity",
      expect.stringMatching(/^Semicolon part: "bad;sku" isn't/),
      expect.stringMatching(/^Zero: quantity 0 is outside/),
      expect.stringMatching(/^ok-3: quantity 100000 is outside/),
      expect.stringMatching(/^Half: quantity 2.5 is outside/),
    ]);
  });

  it("stops at the line limit", () => {
    const lines = Array.from({ length: MAX_LINES + 5 }, (_, i) => ({ sku: `p-${i}`, quantity: 1, description: "" }));
    const out = toQuickOrder({ lines, unreadable: [] });
    expect(out.count).toBe(MAX_LINES);
    expect(out.skipped.at(-1)).toMatch(/More than/);
  });
});
