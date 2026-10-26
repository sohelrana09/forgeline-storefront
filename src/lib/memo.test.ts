import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { staleWhileRevalidate } from "@/lib/memo";

// Lets a pending load finish (resolved promises and their .then callbacks).
const settle = () => new Promise((r) => setImmediate(r));

describe("staleWhileRevalidate", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));
  afterEach(() => vi.useRealTimers());

  it("loads once and serves the cached value within the TTL", async () => {
    const memo = staleWhileRevalidate<string>(1000);
    const load = vi.fn(async () => "a");
    expect(await memo("k", load)).toBe("a");
    expect(await memo("k", load)).toBe("a");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("serves the stale value at once and refreshes in the background", async () => {
    const memo = staleWhileRevalidate<string>(1000);
    await memo("k", async () => "old");
    vi.advanceTimersByTime(1500);
    expect(await memo("k", async () => "new")).toBe("old"); // no waiting for the reload
    await settle();
    expect(await memo("k", async () => "unused")).toBe("new");
  });

  it("does not cache a failed first load", async () => {
    const memo = staleWhileRevalidate<string>(1000);
    await expect(memo("k", async () => Promise.reject(new Error("down")))).rejects.toThrow("down");
    expect(await memo("k", async () => "ok")).toBe("ok");
  });

  // Regression: a refresh that started before forget() must not write its older result back.
  it("drops a refresh that started before the key was forgotten", async () => {
    const memo = staleWhileRevalidate<string>(1000);
    await memo("k", async () => "v1");
    vi.advanceTimersByTime(1500);
    let finish!: (v: string) => void;
    memo("k", () => new Promise((r) => (finish = r))); // background refresh starts
    memo.forget("k");
    finish("stale-from-before-forget");
    await settle();
    expect(await memo("k", async () => "fresh")).toBe("fresh");
  });

  // Regression: forgetting one key must not freeze another key's refresh.
  it("keeps other keys refreshing when one key is forgotten", async () => {
    const memo = staleWhileRevalidate<string>(1000);
    await memo("a", async () => "a1");
    await memo("b", async () => "b1");
    vi.advanceTimersByTime(1500);
    expect(await memo("b", async () => "b2")).toBe("b1");
    memo.forget("a");
    await settle();
    expect(await memo("b", async () => "unused")).toBe("b2");
  });
});
