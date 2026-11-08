import { describe, expect, it } from "vitest";
import { basePolicy, shellPolicy, newNonce, nonceOf, noncePolicy, studioOrigin, studioPolicy } from "@/lib/csp";

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

  it("adds Tag Manager and GA4 hosts only when analytics is on", () => {
    const on = { dev: false, analytics: true };
    expect(scriptSrc(shellPolicy(on))).toBe("script-src 'self' 'unsafe-inline' https://www.googletagmanager.com");
    // 'strict-dynamic' already trusts what the bundled loader adds: no host in the nonce policy's script-src.
    expect(scriptSrc(noncePolicy("abc", on))).not.toContain("googletagmanager");
    for (const p of [shellPolicy(on), noncePolicy("abc", on)]) {
      expect(directive(p, "connect-src")).toContain("https://*.google-analytics.com");
      expect(directive(p, "img-src")).toContain("https://*.google-analytics.com");
    }
    expect(shellPolicy(prod)).not.toMatch(/googletagmanager|google-analytics/);
    expect(noncePolicy("abc", prod)).not.toContain("google-analytics");
  });

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
    // Checkout's script loads its own stylesheets; a blocked one stops it before it lists payment methods.
    expect(directive(noncePolicy("abc", prod), "style-src")).toContain("https://*.commercetools.com");
    expect(directive(shellPolicy(prod), "frame-src")).not.toContain("commercetools");
    expect(directive(shellPolicy(prod), "style-src")).toBe("style-src 'self' 'unsafe-inline'");
    // Its page loads Roboto from Google Fonts.
    expect(directive(noncePolicy("abc", prod), "style-src")).toContain("https://fonts.googleapis.com");
    expect(directive(noncePolicy("abc", prod), "font-src")).toContain("https://fonts.gstatic.com");
    expect(directive(shellPolicy(prod), "font-src")).toBe("font-src 'self' data:");
  });

  it("allows PayPal on per-visitor pages only when it is switched on", () => {
    const on = noncePolicy("abc", { dev: false, paypal: true });
    for (const name of ["connect-src", "frame-src", "img-src", "style-src"]) {
      expect(directive(on, name)).toContain("https://*.paypal.com");
      expect(directive(noncePolicy("abc", prod), name)).not.toContain("paypal");
      expect(directive(shellPolicy({ dev: false, paypal: true }), name)).not.toContain("paypal");
    }
  });

  it("allows Braintree on per-visitor pages only when it is switched on", () => {
    const on = noncePolicy("abc", { dev: false, braintree: true });
    for (const name of ["connect-src", "frame-src"]) {
      expect(directive(on, name)).toContain("https://*.braintreegateway.com");
      expect(directive(on, name)).toContain("https://*.braintree-api.com");
      expect(directive(on, name)).toContain("https://*.cardinalcommerce.com");
      expect(directive(on, name)).toContain("https://*.cardinaltrusted.com");
      expect(directive(noncePolicy("abc", prod), name)).not.toContain("braintree");
      expect(directive(shellPolicy({ dev: false, braintree: true }), name)).not.toContain("braintree");
    }
    // Cardinal posts its device-fingerprint and 3-D Secure forms from the page.
    expect(directive(on, "form-action")).toBe("form-action 'self' https://*.cardinalcommerce.com");
    expect(directive(noncePolicy("abc", prod), "form-action")).toBe("form-action 'self'");
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

describe("nonceOf", () => {
  it("reads the nonce back from a nonce policy", () => {
    const nonce = newNonce();
    expect(nonceOf(noncePolicy(nonce, { dev: false }))).toBe(nonce);
  });

  it("is undefined without one", () => {
    expect(nonceOf(shellPolicy({ dev: false }))).toBeUndefined();
    expect(nonceOf(null)).toBeUndefined();
  });
});
