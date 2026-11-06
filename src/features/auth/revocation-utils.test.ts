import { describe, expect, it } from "vitest";
import { parseRevocation, PASSWORD_MIN, sessionRefused, strongEnough, withEndedSession } from "@/features/auth/utils";

describe("session revocation", () => {
  it("reads an older object that only has a time", () => {
    expect(parseRevocation({ after: 5 })).toEqual({ after: 5, ended: [] });
    expect(parseRevocation(undefined)).toEqual({ after: 0, ended: [] });
  });

  it("refuses sessions before the mark and ended ones, and no others", () => {
    const value = { after: 100, ended: [{ sid: "a", until: 900 }] };
    expect(sessionRefused(value, 99, "b")).toBe(true);
    expect(sessionRefused(value, 100, "a")).toBe(true);
    expect(sessionRefused(value, 100, "b")).toBe(false);
    expect(sessionRefused(value, 100, undefined)).toBe(false);
  });

  it("drops ended sessions that have expired anyway", () => {
    const value = { after: 0, ended: [{ sid: "old", until: 10 }] };
    expect(withEndedSession(value, "new", 100, 50).ended).toEqual([{ sid: "new", until: 100 }]);
  });

  it("keeps the time when a session ends", () => {
    expect(withEndedSession({ after: 7, ended: [] }, "a", 100, 50).after).toBe(7);
  });

  it("stays a bounded list", () => {
    let value = parseRevocation(undefined);
    for (let i = 0; i < 60; i++) value = withEndedSession(value, `s${i}`, 1_000, 1);
    expect(value.ended).toHaveLength(50);
    expect(value.ended.at(-1)?.sid).toBe("s59");
  });
});

describe("strongEnough", () => {
  it("wants the minimum length, a letter and a digit", () => {
    expect(strongEnough("a1".repeat(PASSWORD_MIN / 2))).toBe(true);
    expect(strongEnough("a1".repeat(PASSWORD_MIN / 2 - 1))).toBe(false);
    expect(strongEnough("a".repeat(PASSWORD_MIN))).toBe(false);
    expect(strongEnough("1".repeat(PASSWORD_MIN))).toBe(false);
  });
});
