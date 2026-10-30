import { describe, expect, it } from "vitest";
import { csvToLines, parseCsv } from "@/features/quick-order/csv";
import { parseQuickOrder } from "@/features/quick-order/parser";

describe("parseCsv", () => {
  it("reads quoted fields with separators, quotes and line breaks", () => {
    expect(parseCsv('a,"b, c","say ""hi""","two\nlines"\r\nd,e,,f')).toEqual([
      ["a", "b, c", 'say "hi"', "two\nlines"],
      ["d", "e", "", "f"],
    ]);
  });

  it("detects semicolons and tabs, drops a byte-order mark and blank rows", () => {
    expect(parseCsv("﻿sku;qty\n\nair-filter;24\n")).toEqual([
      ["sku", "qty"],
      ["air-filter", "24"],
    ]);
    expect(parseCsv("air-filter\t24\noil-filter\t6")).toEqual([
      ["air-filter", "24"],
      ["oil-filter", "6"],
    ]);
  });
});

describe("csvToLines", () => {
  it("finds the SKU and quantity columns by their header, whatever else the sheet has", () => {
    const sheet = "Product name;Article No;Unit price;Order qty\nAir Filter;air-filter;40,00;24\nOil Filter;oil-filter;30,00;12\n";
    expect(csvToLines(sheet)).toEqual({
      lines: ["air-filter, 24", "oil-filter, 12"],
      skipped: 0,
      columns: { sku: "Article No", quantity: "Order qty" },
    });
  });

  it("without a header uses the first two columns", () => {
    expect(csvToLines("air-filter,24\noil-filter,12").lines).toEqual(["air-filter, 24", "oil-filter, 12"]);
  });

  it("reads a spreadsheet's 12.0 as 12, a missing quantity as 1, and skips rows without a SKU", () => {
    const result = csvToLines("SKU,Quantity\nair-filter,12.0\noil-filter,\n,5\nTotal,\n");
    expect(result.lines).toEqual(["air-filter, 12", "oil-filter, 1", "Total, 1"]);
    expect(result.skipped).toBe(1);
  });

  it("produces lines the quick-order parser accepts, and leaves bad values for it to report", () => {
    const { lines } = csvToLines("sku,qty\nair-filter,24\nair-filter,6\nbad sku!,2\noil-filter,many");
    const parsed = parseQuickOrder(lines.join("\n"));
    expect(parsed.lines).toEqual([{ sku: "air-filter", quantity: 30 }]);
    expect(parsed.errors.map((e) => e.line)).toEqual([3, 4]);
  });

  it("returns nothing for an empty file", () => {
    expect(csvToLines("\n\n")).toEqual({ lines: [], skipped: 0 });
  });
});
