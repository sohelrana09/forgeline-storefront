import { describe, expect, it, vi } from "vitest";

// Without Redis env vars the limiter counts in memory, which is what these tests exercise.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
const { reserveAttempt } = await import("@/lib/rate-limit");

describe("reserveAttempt", () => {
  it("lets only `max` of a burst of parallel attempts through", async () => {
    const limits = [{ key: "burst", max: 3 }];
    const results = await Promise.all(Array.from({ length: 20 }, () => reserveAttempt(limits)));
    expect(results.filter(Boolean)).toHaveLength(3);
  });

  it("doesn't count attempts that were released after succeeding", async () => {
    const limits = [{ key: "success", max: 2 }];
    for (let i = 0; i < 5; i++) await (await reserveAttempt(limits))!();
    expect(await reserveAttempt(limits)).toBeDefined();
  });

  it("refuses when any key is over its limit and takes the attempt back on all keys", async () => {
    const tight = { key: "tight", max: 1 };
    const loose = { key: "loose", max: 2 };
    expect(await reserveAttempt([tight])).toBeDefined(); // a failure on the tight key
    expect(await reserveAttempt([tight, loose])).toBeUndefined();
    // The refused attempt didn't count on the loose key: two more still fit.
    expect(await reserveAttempt([loose])).toBeDefined();
    expect(await reserveAttempt([loose])).toBeDefined();
    expect(await reserveAttempt([loose])).toBeUndefined();
  });
});
