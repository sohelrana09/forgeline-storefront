// Content-Security-Policy for pages, set by src/proxy.ts. Private pages (rendered per request) get a fresh nonce with
// 'strict-dynamic' (Next puts it on its scripts; what they load is trusted; 'unsafe-inline' and https: only serve
// browsers without nonce support). Prerendered shells are built once for everyone, so they can't carry a nonce:
// scripts from this site only, inline allowed for Next's bootstrap. The Studio also needs 'unsafe-eval' and Sanity's
// script host.
// Every page also limits where it may load from and send to (default-src 'self' plus the hosts below), so a script
// that got in anyway can't send what it reads to another site.
// BASE repeats next.config.ts, which covers the responses the proxy doesn't see. Framing: this site, plus the Studio's
// own domain when it runs outside the storefront (its Presentation tool previews the pages in an iframe).
export type PolicyOptions = { dev: boolean; sanityProjectId?: string; studioOrigin?: string };

export const basePolicy = (studioOrigin?: string) => [
  `frame-ancestors ${["'self'", ...(studioOrigin ? [studioOrigin] : [])].join(" ")}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

// React's development build needs eval; the dev server's live reload uses a WebSocket.
const devEval = (dev: boolean) => (dev ? ["'unsafe-eval'"] : []);
const devSocket = (dev: boolean) => (dev ? ["ws:"] : []);

// Pictures come through /_next/image, except the purchase-list thumbnails (product images: the sample data's bucket
// and the commercetools CDN) and Sanity's CDN.
const IMAGES = ["'self'", "data:", "blob:", "https://storage.googleapis.com", "https://*.commercetools.com", "https://cdn.sanity.io"];
// commercetools Checkout (card payments): its SDK, its iframes and the payment connector's service.
const CHECKOUT = ["https://*.commercetools.com", "https://*.commercetools.app"];

// Sanity's API for this project only: draft preview (Visual Editing) on the storefront's pages.
const sanityApi = (projectId?: string) => (projectId ? [`https://${projectId}.api.sanity.io`, `wss://${projectId}.api.sanity.io`] : []);

function pagePolicy(connect: string[], frames: string[], dev: boolean) {
  return [
    "default-src 'self'",
    `img-src ${IMAGES.join(" ")}`,
    // Next and the Studio set inline styles.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `connect-src ${["'self'", ...connect, ...devSocket(dev)].join(" ")}`,
    `frame-src ${["'self'", ...frames].join(" ")}`,
    "worker-src 'self' blob:",
  ];
}

export function noncePolicy(nonce: string, { dev, studioOrigin }: PolicyOptions): string {
  const scripts = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "https:", "'unsafe-inline'", ...devEval(dev)];
  return [...basePolicy(studioOrigin), `script-src ${scripts.join(" ")}`, ...pagePolicy(CHECKOUT, CHECKOUT, dev)].join("; ");
}

export function shellPolicy({ dev, sanityProjectId, studioOrigin }: PolicyOptions): string {
  const scripts = ["'self'", "'unsafe-inline'", ...devEval(dev)];
  return [...basePolicy(studioOrigin), `script-src ${scripts.join(" ")}`, ...pagePolicy(sanityApi(sanityProjectId), [], dev)].join("; ");
}

// The Studio talks to many Sanity hosts (API, live updates, image uploads, sign-in) and is kept apart from the
// storefront's pages by its own policy; ideally it runs on its own domain (STUDIO_URL, see docs/sanity-studio.md).
const SANITY_SCRIPTS = "https://core.sanity-cdn.com";
export const studioPolicy = () => [...basePolicy(), `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${SANITY_SCRIPTS}`].join("; ");

// The origin of STUDIO_URL (a Studio deployed with `sanity deploy` or on its own domain), or undefined.
export function studioOrigin(studioUrl: string | undefined): string | undefined {
  if (!studioUrl) return undefined;
  try {
    const url = new URL(studioUrl);
    return url.protocol === "https:" || url.hostname === "localhost" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
