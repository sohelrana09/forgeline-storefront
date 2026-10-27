import { describe, expect, it } from "vitest";
import { safeHref } from "@/features/cms/utils";

describe("safeHref", () => {
  it("allows site paths, https and mailto links", () => {
    expect(safeHref("/excavators")).toBe("/excavators");
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHref("mailto:sales@example.com")).toBe("mailto:sales@example.com");
  });

  it("refuses links that leave the site in disguise or run script", () => {
    expect(safeHref("//evil.example")).toBeUndefined();
    expect(safeHref("/\\evil.example")).toBeUndefined();
    expect(safeHref("/\t/evil.example")).toBeUndefined();
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("http://example.com")).toBeUndefined();
    expect(safeHref(42)).toBeUndefined();
  });
});
