import { describe, expect, it } from "vitest";
import { FREEZE_TTL_MS, freezeState } from "@/features/cart/freeze";

const NOW = Date.parse("2026-11-06T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("freezeState", () => {
  it("an active cart is open", () => {
    expect(freezeState({ cartState: "Active", lastModifiedAt: ago(0) }, NOW)).toBe("open");
  });

  it("a recently frozen cart is locked", () => {
    expect(freezeState({ cartState: "Frozen", lastModifiedAt: ago(FREEZE_TTL_MS - 1) }, NOW)).toBe("locked");
  });

  it("a freeze nobody touched for longer than the TTL is stale", () => {
    expect(freezeState({ cartState: "Frozen", lastModifiedAt: ago(FREEZE_TTL_MS + 1) }, NOW)).toBe("stale");
    expect(freezeState({ cartState: "Frozen", lastModifiedAt: "not a date" }, NOW)).toBe("stale");
  });
});
