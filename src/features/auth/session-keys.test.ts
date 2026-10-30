import { beforeEach, describe, expect, it, vi } from "vitest";

// Cookie keys: SESSION_SECRET, its rotation (SESSION_SECRET_PREVIOUS) and the key from CTP_CLIENT_SECRET that sealed
// cookies before SESSION_SECRET existed. Each case loads the module fresh, as a new deployment with new settings.
const jar = new Map<string, string>();

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
  refreshCustomerToken: vi.fn(),
  refreshAnonymousToken: vi.fn(),
  revokeToken: vi.fn(),
}));
vi.mock("@/features/business-units/service", () => ({ GUEST_STORE_KEY: "default-store", getBuyingContexts: vi.fn() }));
vi.mock("@/features/auth/revocation", () => ({ sessionsValidAfter: async () => 0 }));

const API = "api-client-secret";
const ONE = "a".repeat(32);
const TWO = "b".repeat(32);
const session = { accessToken: "t", customerId: "c1", email: "a@b.c", issuedAt: Date.now(), expiresAt: Date.now() + 3_600_000 };

// A deployment with these settings: seals a cookie, or reads the one in the jar.
async function deployment(env: { SESSION_SECRET?: string; SESSION_SECRET_PREVIOUS?: string; CTP_CLIENT_SECRET?: string }) {
  vi.resetModules();
  for (const k of ["SESSION_SECRET", "SESSION_SECRET_PREVIOUS", "CTP_CLIENT_SECRET"] as const) {
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  const m = await import("@/features/auth/session");
  return {
    seal: () => jar.set(m.SESSION_COOKIE, m.sealSession(session)),
    opens: async () => (await m.getSession())?.customerId === "c1",
  };
}

beforeEach(() => jar.clear());

describe("session cookie keys", () => {
  it("keeps cookies from before SESSION_SECRET open after it is set", async () => {
    (await deployment({ CTP_CLIENT_SECRET: API })).seal();
    expect(await (await deployment({ SESSION_SECRET: ONE, CTP_CLIENT_SECRET: API })).opens()).toBe(true);
  });

  it("seals with SESSION_SECRET, independent of the API secret", async () => {
    (await deployment({ SESSION_SECRET: ONE, CTP_CLIENT_SECRET: API })).seal();
    expect(await (await deployment({ SESSION_SECRET: ONE, CTP_CLIENT_SECRET: "rotated-api-secret" })).opens()).toBe(true);
  });

  it("rotates without signing anyone out while the old secret is SESSION_SECRET_PREVIOUS", async () => {
    (await deployment({ SESSION_SECRET: ONE })).seal();
    expect(await (await deployment({ SESSION_SECRET: TWO, SESSION_SECRET_PREVIOUS: ONE })).opens()).toBe(true);
    expect(await (await deployment({ SESSION_SECRET: TWO })).opens()).toBe(false);
  });

  it("refuses short secrets and a missing key", async () => {
    expect((await deployment({ SESSION_SECRET: "short" })).seal).toThrow(/32 characters/);
    expect((await deployment({})).seal).toThrow(/required/);
  });
});
