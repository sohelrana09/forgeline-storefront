import { describe, expect, it } from "vitest";
import { BASE_POLICY, shellPolicy, newNonce, noncePolicy, studioPolicy } from "@/lib/csp";

const scriptSrc = (policy: string) => policy.split("; ").find((d) => d.startsWith("script-src "));

describe("CSP", () => {
  it("keeps the base directives in every policy", () => {
    for (const p of [noncePolicy("abc", false), shellPolicy(false), studioPolicy()]) expect(p.startsWith(BASE_POLICY)).toBe(true);
  });

  it("trusts only the nonce and what it loads on per-visitor pages", () =>
    expect(scriptSrc(noncePolicy("abc", false))).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic' https: 'unsafe-inline'"));

  it("allows only this site's scripts on cached pages", () =>
    expect(scriptSrc(shellPolicy(false))).toBe("script-src 'self' 'unsafe-inline'"));

  it("lets the Studio load Sanity's bridge script", () => expect(scriptSrc(studioPolicy())).toContain("https://core.sanity-cdn.com"));

  it("adds eval in development only", () => {
    expect(noncePolicy("abc", true)).toContain("'unsafe-eval'");
    expect(noncePolicy("abc", false)).not.toContain("'unsafe-eval'");
    expect(shellPolicy(true)).toContain("'unsafe-eval'");
  });

  it("makes a new 128-bit nonce each time", () => {
    const a = newNonce();
    expect(atob(a)).toHaveLength(16);
    expect(newNonce()).not.toBe(a);
  });
});
