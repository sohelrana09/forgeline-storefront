import { describe, expect, it } from "vitest";
import { compareHref, compareRows, downloadsOf, parseCompareSkus, toggleCompare } from "@/features/compare/compare";

describe("compare list", () => {
  it("reads up to four distinct, valid SKUs from the URL", () => {
    expect(parseCompareSkus("a, b,a,<x>,c,d,e")).toEqual(["a", "b", "c", "d"]);
    expect(parseCompareSkus(["a", "b"])).toEqual(["a", "b"]);
    expect(parseCompareSkus(undefined)).toEqual([]);
  });
  it("toggles a SKU and drops the oldest past the limit", () => {
    expect(toggleCompare(["a"], "a")).toEqual([]);
    expect(toggleCompare(["a", "b", "c", "d"], "e")).toEqual(["b", "c", "d", "e"]);
    expect(toggleCompare(["a"], "bad sku")).toEqual(["a"]);
  });
  it("builds the shareable URL", () => expect(compareHref(["a", "b"])).toBe("/compare?skus=a,b"));
});

describe("compareRows", () => {
  it("lines specifications up and flags the ones that differ", () => {
    expect(
      compareRows([
        {
          sku: "a",
          specs: [
            { name: "Color", value: "Red" },
            { name: "Model", value: "2019" },
          ],
        },
        {
          sku: "b",
          specs: [
            { name: "Color", value: "Red" },
            { name: "Capacity", value: "500" },
          ],
        },
      ]),
    ).toEqual([
      { name: "Color", values: ["Red", "Red"], differs: false },
      { name: "Model", values: ["2019", ""], differs: true },
      { name: "Capacity", values: ["", "500"], differs: true },
    ]);
  });
});

describe("downloadsOf", () => {
  it("lists https assets with their kind and skips the rest", () => {
    expect(
      downloadsOf(
        [
          {
            name: { "en-US": "Manual" },
            sources: [{ uri: "https://cdn.example.com/m.jpg" }, { uri: "https://cdn.example.com/m.pdf", contentType: "application/pdf" }],
          },
          { name: { de: "CAD" }, sources: [{ uri: "https://cdn.example.com/cad.step?v=2" }] },
          { name: { "en-US": "Bad" }, sources: [{ uri: "javascript:alert(1)" }, { uri: "http://x/y.pdf" }] },
        ],
        "en-US",
      ),
    ).toEqual([
      { name: "Manual", url: "https://cdn.example.com/m.pdf", kind: "PDF" },
      { name: "CAD", url: "https://cdn.example.com/cad.step?v=2", kind: "STEP" },
    ]);
  });
});
