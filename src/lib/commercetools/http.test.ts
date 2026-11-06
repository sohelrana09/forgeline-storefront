import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { resilient } = await import("@/lib/commercetools/http");

const noDelay = async () => undefined;
const respond = (status: number) => new Response("{}", { status });

describe("resilient", () => {
  it("retries a read on 503 and returns the later answer", async () => {
    const base = vi.fn<typeof fetch>().mockResolvedValueOnce(respond(503)).mockResolvedValueOnce(respond(200));
    const res = await resilient(base, noDelay)("https://ct/x");
    expect(res.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it("stops after two retries and returns the last answer", async () => {
    const base = vi.fn<typeof fetch>(async () => respond(429));
    const res = await resilient(base, noDelay)("https://ct/x", { method: "GET" });
    expect(res.status).toBe(429);
    expect(base).toHaveBeenCalledTimes(3);
  });

  it("never retries a write, which may have worked", async () => {
    const base = vi.fn<typeof fetch>(async () => respond(503));
    const res = await resilient(base, noDelay)("https://ct/orders", { method: "POST" });
    expect(res.status).toBe(503);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("does not retry a failed write either", async () => {
    const base = vi.fn<typeof fetch>(async () => Promise.reject(new TypeError("reset")));
    await expect(resilient(base, noDelay)("https://ct/orders", { method: "POST" })).rejects.toThrow("reset");
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("retries a read after a connection failure", async () => {
    const base = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError("reset")).mockResolvedValueOnce(respond(200));
    expect((await resilient(base, noDelay)("https://ct/x")).status).toBe(200);
  });

  it("gives every call a timeout signal", async () => {
    const base = vi.fn<typeof fetch>(async () => respond(200));
    await resilient(base, noDelay)("https://ct/x");
    expect(base.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
