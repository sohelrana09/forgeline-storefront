import { describe, expect, it } from "vitest";
import { basePolicy, shellPolicy, newNonce, noncePolicy, studioOrigin, studioPolicy } from "@/lib/csp";

const directive = (policy: string, name: string) => policy.split("; ").find((d) => d.startsWith(`${name} `));
const scriptSrc = (policy: string) => directive(policy, "script-src");
const prod = { dev: false };

describe("CSP", () => {
  it("keeps the base directives in every policy", () => {
    const base = basePolicy().join("; ");
    for (const p of [noncePolicy("abc", prod), shellPolicy(prod), studioPolicy()]) expect(p.startsWith(base)).toBe(true);
  });

  it("trusts only the nonce and what it loads on per-visitor pages", () =>
    expect(scriptSrc(noncePolicy("abc", prod))).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic' https: 'unsafe-inline'"));

  it("allows only this site's scripts on cached pages", () =>
    expect(scriptSrc(shellPolicy(prod))).toBe("script-src 'self' 'unsafe-inline'"));

  it("lets the Studio load Sanity's bridge script", () => expect(scriptSrc(studioPolicy())).toContain("https://core.sanity-cdn.com"));

  it("adds eval and the live-reload socket in development only", () => {
    expect(noncePolicy("abc", { dev: true })).toContain("'unsafe-eval'");
    expect(noncePolicy("abc", prod)).not.toContain("'unsafe-eval'");
    expect(shellPolicy({ dev: true })).toContain("'unsafe-eval'");
    expect(directive(shellPolicy({ dev: true }), "connect-src")).toContain("ws:");
    expect(directive(shellPolicy(prod), "connect-src")).not.toContain("ws:");
  });

  it("lets cached pages send data to this site only, plus this project's Sanity API for draft preview", () => {
    expect(directive(shellPolicy(prod), "default-src")).toBe("default-src 'self'");
    expect(directive(shellPolicy(prod), "connect-src")).toBe("connect-src 'self'");
    expect(directive(shellPolicy(prod), "frame-src")).toBe("frame-src 'self'");
    expect(directive(shellPolicy({ dev: false, sanityProjectId: "abc123" }), "connect-src")).toBe(
      "connect-src 'self' https://abc123.api.sanity.io wss://abc123.api.sanity.io",
    );
  });

  it("allows commercetools Checkout on per-visitor pages (card payment)", () => {
    expect(directive(noncePolicy("abc", prod), "connect-src")).toContain("https://*.commercetools.com");
    expect(directive(noncePolicy("abc", prod), "frame-src")).toContain("https://*.commercetools.app");
    expect(directive(shellPolicy(prod), "frame-src")).not.toContain("commercetools");
  });

  it("lets a Studio on its own domain frame the pages", () => {
    const origin = studioOrigin("https://forgeline.sanity.studio/structure");
    expect(origin).toBe("https://forgeline.sanity.studio");
    expect(directive(shellPolicy({ dev: false, studioOrigin: origin }), "frame-ancestors")).toBe(
      "frame-ancestors 'self' https://forgeline.sanity.studio",
    );
    expect(directive(shellPolicy(prod), "frame-ancestors")).toBe("frame-ancestors 'self'");
  });

  it("accepts only https Studio URLs (localhost for development)", () => {
    expect(studioOrigin("http://studio.example.com")).toBeUndefined();
    expect(studioOrigin("not a url")).toBeUndefined();
    expect(studioOrigin(undefined)).toBeUndefined();
    expect(studioOrigin("http://localhost:3333")).toBe("http://localhost:3333");
  });

  it("makes a new 128-bit nonce each time", () => {
    const a = newNonce();
    expect(atob(a)).toHaveLength(16);
    expect(newNonce()).not.toBe(a);
  });
});
