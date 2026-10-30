// Content-Security-Policy for pages, set by src/proxy.ts. Private pages (rendered per request) get a fresh nonce with
// 'strict-dynamic' (Next puts it on its scripts; what they load is trusted; 'unsafe-inline' and https: only serve
// browsers without nonce support). Prerendered shells are built once for everyone, so they can't carry a nonce:
// scripts from this site only, inline allowed for Next's bootstrap. The Studio also needs 'unsafe-eval' and Sanity's
// script host.
// BASE repeats next.config.ts, which covers the responses the proxy doesn't see.
const BASE = ["frame-ancestors 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"];

// React's development build needs eval.
const devEval = (dev: boolean) => (dev ? ["'unsafe-eval'"] : []);

export const BASE_POLICY = BASE.join("; ");

export function noncePolicy(nonce: string, dev: boolean): string {
  const scripts = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "https:", "'unsafe-inline'", ...devEval(dev)];
  return [...BASE, `script-src ${scripts.join(" ")}`].join("; ");
}

export function shellPolicy(dev: boolean): string {
  return [...BASE, `script-src ${["'self'", "'unsafe-inline'", ...devEval(dev)].join(" ")}`].join("; ");
}

const SANITY_SCRIPTS = "https://core.sanity-cdn.com";
export const studioPolicy = () => [...BASE, `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${SANITY_SCRIPTS}`].join("; ");

export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
