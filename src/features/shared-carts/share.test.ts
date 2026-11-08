import { describe, expect, it } from "vitest";
import {
  canReview,
  endShareActions,
  parseShareNote,
  readShare,
  shareActions,
  shareRole,
  sharedCartsEnabled,
} from "@/features/shared-carts/share";

const A = "a0000000-0000-0000-0000-000000000000";
const B = "b0000000-0000-0000-0000-000000000000";

describe("canReview", () => {
  it("needs ordering and both others'-carts permissions", () => {
    expect(canReview(new Set(["CreateMyOrdersFromMyCarts", "ViewOthersCarts", "UpdateOthersCarts"]))).toBe(true);
    expect(canReview(new Set(["CreateMyOrdersFromMyCarts", "ViewOthersCarts"]))).toBe(false);
    expect(canReview(undefined)).toBe(false);
  });
});

describe("share fields", () => {
  it("sets the Type on a cart without one", () => {
    expect(shareActions(undefined, { sharedWith: B, sharedBy: A, sharedAt: "2026-11-08T10:00:00Z" })).toEqual([
      {
        action: "setCustomType",
        type: { typeId: "type", key: "order-approval" },
        fields: { sharedWith: B, sharedBy: A, sharedAt: "2026-11-08T10:00:00Z" },
      },
    ]);
  });
  it("keeps other features' fields on a cart with the Type", () => {
    const custom = { fields: { costCentre: "CC", sharedWith: B, sharedBy: A, sharedAt: "t", shareNote: "n" } };
    expect(endShareActions(custom, true)).toEqual([
      { action: "setCustomField", name: "sharedWith", value: undefined },
      { action: "setCustomField", name: "sharedAt", value: undefined },
      { action: "setCustomField", name: "shareNote", value: undefined },
    ]);
    expect(endShareActions(custom, false).map((a) => (a as { name: string }).name)).toContain("sharedBy");
  });
  it("reads and relates", () => {
    const share = readShare({ fields: { sharedWith: B, sharedBy: A, sharedAt: "", shareNote: 5 } });
    expect(share).toEqual({ sharedWith: B, sharedBy: A, sharedAt: undefined, shareNote: undefined });
    expect(shareRole(share, B)).toBe("reviewer");
    expect(shareRole(share, A)).toBe("sender");
    expect(shareRole(share, "c")).toBeUndefined();
    expect(shareRole({ sharedBy: A }, A)).toBeUndefined();
  });
});

describe("parseShareNote", () => {
  it("cleans and limits the note", () => {
    expect(parseShareNote("  Please order by Friday‮ ")).toEqual({ ok: true, note: "Please order by Friday" });
    expect(parseShareNote("")).toEqual({ ok: true, note: undefined });
    expect(parseShareNote("x".repeat(301)).ok).toBe(false);
  });
  it("is off unless SHARED_CARTS=true", () => expect(sharedCartsEnabled({})).toBe(false));
});
