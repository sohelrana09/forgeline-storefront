import { describe, expect, it } from "vitest";
import { canCancelRequest, isActionable, isExpired, PO_PATTERN, shortRef } from "@/features/quotes/utils";

const past = new Date(Date.now() - 60_000).toISOString();
const future = new Date(Date.now() + 60_000).toISOString();

describe("quote state", () => {
  it("is expired once validTo has passed", () => {
    expect(isExpired({ validTo: past })).toBe(true);
    expect(isExpired({ validTo: future })).toBe(false);
    expect(isExpired({})).toBe(false);
  });

  it("can be acted on only while Pending and valid", () => {
    expect(isActionable({ quoteState: "Pending", validTo: future })).toBe(true);
    expect(isActionable({ quoteState: "Pending", validTo: past })).toBe(false);
    expect(isActionable({ quoteState: "Accepted" })).toBe(false);
  });

  it("lets only a Submitted request be cancelled", () => {
    expect(canCancelRequest({ quoteRequestState: "Submitted" })).toBe(true);
    expect(canCancelRequest({ quoteRequestState: "Accepted" })).toBe(false);
  });
});

describe("shortRef and PO_PATTERN", () => {
  it("prefers the key, else the id's start", () => {
    expect(shortRef({ key: "Q-1", id: "abc" })).toBe("Q-1");
    expect(shortRef({ id: "098d3a1f-0000" })).toBe("098D3A1F");
  });

  it("accepts plain PO numbers only", () => {
    expect(PO_PATTERN.test("PO-2026/14 #3")).toBe(true);
    expect(PO_PATTERN.test("<script>")).toBe(false);
    expect(PO_PATTERN.test("x".repeat(36))).toBe(false);
  });
});
