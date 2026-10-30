import { beforeEach, describe, expect, it, vi } from "vitest";

// getSession() with its dependencies replaced: the cookie jar, the token refresh and the password-reset mark.
const jar = new Map<string, string>();
const refreshCustomerToken = vi.fn();
const sessionsValidAfter = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/commercetools/client", () => ({ customerApiRoot: vi.fn(), projectKey: "test" }));
vi.mock("@/lib/commercetools/customer-token", () => ({
  refreshCustomerToken: (t: string) => refreshCustomerToken(t),
  refreshAnonymousToken: vi.fn(),
  revokeToken: vi.fn(),
}));
vi.mock("@/features/business-units/service", () => ({ GUEST_STORE_KEY: "default-store", getBuyingContexts: vi.fn() }));
vi.mock("@/features/auth/revocation", () => ({ sessionsValidAfter: (id: string) => sessionsValidAfter(id) }));

process.env.CTP_CLIENT_SECRET = "test-secret-for-the-session-cookie";
const { getSession, sealSession, SESSION_COOKIE } = await import("@/features/auth/session");

const HOUR = 60 * 60 * 1000;
const base = { accessToken: "old", customerId: "c1", email: "a@b.c", issuedAt: Date.now() - 50 * HOUR };
const store = (s: object) => jar.set(SESSION_COOKIE, sealSession(s as Parameters<typeof sealSession>[0]));

beforeEach(() => {
  jar.clear();
  refreshCustomerToken.mockReset();
  sessionsValidAfter.mockReset().mockResolvedValue(0);
});

describe("getSession", () => {
  it("returns a valid session as it is", async () => {
    store({ ...base, expiresAt: Date.now() + HOUR, refreshToken: "r1" });
    expect((await getSession())?.accessToken).toBe("old");
    expect(refreshCustomerToken).not.toHaveBeenCalled();
  });

  it("renews an expired token once and keeps the sign-in time", async () => {
    store({ ...base, expiresAt: Date.now() - HOUR, refreshToken: "r2" });
    refreshCustomerToken.mockResolvedValue({ accessToken: "new", expiresAt: Date.now() + 48 * HOUR });
    const first = await getSession();
    const second = await getSession();
    expect(first?.accessToken).toBe("new");
    expect(first?.issuedAt).toBe(base.issuedAt);
    expect(second?.accessToken).toBe("new");
    expect(refreshCustomerToken).toHaveBeenCalledTimes(1);
  });

  it("ends an expired session without a refresh token (signed in before this change)", async () => {
    store({ ...base, expiresAt: Date.now() - HOUR });
    expect(await getSession()).toBeUndefined();
  });

  it("ends the session when the refresh token no longer works", async () => {
    store({ ...base, expiresAt: Date.now() - HOUR, refreshToken: "r3" });
    refreshCustomerToken.mockResolvedValue(undefined);
    expect(await getSession()).toBeUndefined();
  });

  it("refuses a session from before a password reset without renewing it", async () => {
    store({ ...base, expiresAt: Date.now() - HOUR, refreshToken: "r4" });
    sessionsValidAfter.mockResolvedValue(Date.now() - HOUR);
    expect(await getSession()).toBeUndefined();
    expect(refreshCustomerToken).not.toHaveBeenCalled();
  });

  it("refuses a cookie that was tampered with", async () => {
    jar.set(SESSION_COOKIE, "not-a-sealed-value");
    expect(await getSession()).toBeUndefined();
  });
});
