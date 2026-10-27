import { describe, expect, it } from "vitest";
import { MAX_LINES, parseQuickOrder } from "@/features/quick-order/parser";

describe("parseQuickOrder", () => {
  it("reads SKU and quantity with any of the separators", () => {
    const { lines, errors } = parseQuickOrder("air-filter, 24\noil-filter;6\nhydraulic-hose\t2\nfuel-filter 12");
    expect(errors).toEqual([]);
    expect(lines).toEqual([
      { sku: "air-filter", quantity: 24 },
      { sku: "oil-filter", quantity: 6 },
      { sku: "hydraulic-hose", quantity: 2 },
      { sku: "fuel-filter", quantity: 12 },
    ]);
  });

  it("defaults the quantity to 1 and skips blank lines", () => {
    expect(parseQuickOrder("\n  air-filter  \n\n").lines).toEqual([{ sku: "air-filter", quantity: 1 }]);
  });

  it("merges the same SKU on several lines", () => {
    expect(parseQuickOrder("air-filter, 2\nair-filter, 3").lines).toEqual([{ sku: "air-filter", quantity: 5 }]);
  });

  it("refuses a SKU whose lines add up to more than the maximum", () => {
    const { lines, errors } = parseQuickOrder("air-filter, 9999\nair-filter, 1\noil-filter, 2");
    expect(lines).toEqual([{ sku: "oil-filter", quantity: 2 }]);
    expect(errors).toEqual([{ line: 0, text: "air-filter, 10000", reason: "Quantity must be a whole number from 1 to 9999" }]);
  });

  it("reports bad lines with their line number and keeps the good ones", () => {
    const { lines, errors } = parseQuickOrder("air-filter, 2\nbad sku here\noil-filter, 0\nfuel$filter, 1");
    expect(lines).toEqual([{ sku: "air-filter", quantity: 2 }]);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4]);
    expect(errors[1].reason).toMatch(/1 to 9999/);
  });

  it("caps an order at MAX_LINES different SKUs", () => {
    const text = Array.from({ length: MAX_LINES + 5 }, (_, i) => `sku-${i}, 1`).join("\n");
    const { lines, errors } = parseQuickOrder(text);
    expect(lines).toHaveLength(MAX_LINES);
    expect(errors).toEqual([expect.objectContaining({ line: 0 })]);
  });
});
