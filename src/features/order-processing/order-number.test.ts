import { describe, expect, it } from "vitest";
import {
  counterKey,
  counterNext,
  DEFAULT_ORDER_PREFIX,
  formatOrderNumber,
  orderNumberPrefix,
} from "@/features/order-processing/order-number";

describe("orderNumberPrefix", () => {
  it("uses a valid prefix, upper-cased", () => {
    expect(orderNumberPrefix("fl")).toBe("FL");
    expect(orderNumberPrefix(" WEB2 ")).toBe("WEB2");
  });

  it("falls back to the default for empty or invalid values", () => {
    for (const value of [undefined, "", "F-L", "TOOLONGPREFIX", "ÄB"]) expect(orderNumberPrefix(value)).toBe(DEFAULT_ORDER_PREFIX);
  });
});

describe("formatOrderNumber", () => {
  it("pads the sequence to six digits", () => {
    expect(formatOrderNumber("FL", 2026, 1)).toBe("FL-2026-000001");
    expect(formatOrderNumber("FL", 2026, 123456)).toBe("FL-2026-123456");
  });

  it("keeps sequences longer than six digits", () => {
    expect(formatOrderNumber("FL", 2026, 1234567)).toBe("FL-2026-1234567");
  });

  it("keys the counter by prefix and year", () => {
    expect(counterKey("FL", 2026)).toBe("FL-2026");
  });
});

describe("counterNext", () => {
  it("reads the stored next number", () => {
    expect(counterNext({ next: 42 })).toBe(42);
  });

  it("starts at 1 for a new or broken counter", () => {
    for (const value of [undefined, null, {}, { next: 0 }, { next: -3 }, { next: 1.5 }, { next: "7" }]) expect(counterNext(value)).toBe(1);
  });
});
