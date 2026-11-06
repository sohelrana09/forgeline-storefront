import { describe, expect, it } from "vitest";
import { discountStateLabel, discountStateMessage, nonApplicableMessage, normalizeCode } from "@/features/cart/discount";

describe("normalizeCode", () => {
  it("accepts codes and trims spaces", () => {
    expect(normalizeCode(" BOGO ")).toBe("BOGO");
    expect(normalizeCode("spring_25-off")).toBe("spring_25-off");
  });

  it("refuses empty, too long or odd input", () => {
    for (const input of ["", "   ", "a b", 'x"', "x".repeat(65), "çode"]) expect(normalizeCode(input)).toBeUndefined();
  });
});

describe("discountStateMessage", () => {
  it("says applied when the code matches", () => {
    expect(discountStateMessage("BOGO", "MatchesCart")).toEqual({ ok: true, text: "Discount code BOGO applied." });
  });

  it("keeps a valid code that doesn't match yet, and says so", () => {
    const m = discountStateMessage("BOGO", "DoesNotMatchCart");
    expect(m.ok).toBe(true);
    expect(m.text).toContain("none of the items in your cart qualify");
  });

  it("explains codes that don't apply", () => {
    expect(discountStateMessage("X", "MaxApplicationReached").ok).toBe(false);
    expect(discountStateMessage("X", "NotValid").text).toContain("isn't valid");
    expect(discountStateMessage("X", "ApplicationStoppedByPreviousDiscount").text).toContain("can't be combined");
    expect(discountStateMessage("X", undefined)).toEqual({ ok: false, text: "Discount code X could not be applied." });
  });
});

describe("discountStateLabel", () => {
  it("labels the states", () => {
    expect(discountStateLabel("MatchesCart")).toBe("Applied");
    expect(discountStateLabel("DoesNotMatchCart")).toBe("No qualifying items");
    expect(discountStateLabel("NotActive")).toBe("Not applied");
  });
});

describe("nonApplicableMessage", () => {
  const err = (reason?: string) => ({ body: { errors: [{ code: "DiscountCodeNonApplicable", reason }] } });

  it("doesn't tell unknown codes from others", () => {
    expect(nonApplicableMessage("NOPE", err("DoesNotExist"))).toBe("We don't recognise the discount code NOPE.");
    expect(nonApplicableMessage("NOPE", err())).toBe("We don't recognise the discount code NOPE.");
  });

  it("names an expired or not yet valid code", () => {
    expect(nonApplicableMessage("OLD", err("TimeRangeNonApplicable"))).toContain("isn't valid at the moment");
  });

  it("is undefined for other errors", () => {
    expect(nonApplicableMessage("X", { body: { errors: [{ code: "InvalidOperation" }] } })).toBeUndefined();
    expect(nonApplicableMessage("X", new Error("x"))).toBeUndefined();
  });
});
