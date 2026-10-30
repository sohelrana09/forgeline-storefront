import { NextResponse, type NextRequest } from "next/server";
import { RESERVED_SEGMENTS, isLocalPath } from "@/lib/urls";
import { siteUrl } from "@/lib/site-url";
import { newNonce, noncePolicy, shellPolicy, studioOrigin, studioPolicy, type PolicyOptions } from "@/lib/csp";
import { resolvePath, type UrlIndex, type UrlTarget } from "@/features/urls/url-index";

// Every page gets its Content-Security-Policy here (src/lib/csp.ts), chosen by route group:
// - the private pages (src/app/(private): account, cart, checkout, order confirmation, sign-in) render fully per
//   request, so they get a fresh nonce with 'strict-dynamic' (Next reads it from the request's CSP header and puts it
//   on its scripts);
// - every other page ((shop): catalog, content, blog, search, quick order) is a prerendered shell shared by all
//   visitors, which can't carry a nonce: scripts from this site only, inline allowed for Next's bootstrap;
// - the Studio also needs 'unsafe-eval' and Sanity's script host.
// Form posts (Server Actions) render per request too, so they get a nonce wherever they go.
//
// Redirects are decided here too, before any page renders: pages stream, and a redirect() after the first byte becomes
// a client-side redirect with status 200. Catalog redirects (old URLs, other spellings, merchants' redirects) come from
// the URL index; the account pages send visitors without a session to /login. The pages keep their own checks.
const PRIVATE_SEGMENTS = new Set([
  "account",
  "cart",
  "checkout",
  "order-confirmation",
  "login",
  "logout",
  "register",
  "forgot-password",
  "reset-password",
  "verify-email",
  "no-access",
]);
const DEV = process.env.NODE_ENV !== "production";
// A Studio on its own domain (STUDIO_URL, docs/sanity-studio.md): /studio leads there, and its preview may frame pages.
const STUDIO_URL = process.env.STUDIO_URL;
const POLICY: PolicyOptions = { dev: DEV, sanityProjectId: process.env.NEXT_SANITY_PROJECT_ID, studioOrigin: studioOrigin(STUDIO_URL) };

// Catalog URLs: not the app's own routes, not files (catalog URL keys never contain a dot). Old /c/, /p/ and /pages/
// URLs count: they redirect from the catalog route.
const isCatalogPath = (pathname: string) => {
  const first = pathname.split("/")[1] ?? "";
  return pathname === "/" || (!pathname.includes(".") && !RESERVED_SEGMENTS.has(first));
};

// Matches SESSION_COOKIE in src/features/auth/session.ts (the proxy can't import it: that module reads server-only
// secrets).
const SESSION_COOKIE = "ct_session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Redirects are for page loads only; the router's own requests (prefetches and client navigations, sent with the RSC
  // header) go on to the page. The router re-fetches a prefetched link that answers with an HTTP redirect, again and
  // again, so links that may point at a redirecting URL (editors' links in CMS content) don't prefetch.
  const pageLoad = (request.method === "GET" || request.method === "HEAD") && !request.headers.has("rsc");
  // Catalog URLs are lowercase (urlKey). Redirecting other casings before the page cache matters: a cached redirect
  // for "/Excavators" would overwrite the "/excavators" shell on a case-insensitive disk (macOS) and loop.
  if (pageLoad && isCatalogPath(pathname) && pathname !== pathname.toLowerCase()) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.toLowerCase();
    return NextResponse.redirect(url, 308);
  }
  if (pathname === "/studio" || pathname.startsWith("/studio/")) {
    if (POLICY.studioOrigin) return NextResponse.redirect(`${STUDIO_URL!.replace(/\/+$/, "")}${pathname.slice("/studio".length)}`, 307);
    return withPolicy(NextResponse.next(), studioPolicy());
  }
  const first = pathname.split("/")[1] ?? "";
  if (pageLoad && first === "account" && !request.cookies.has(SESSION_COOKIE))
    return NextResponse.redirect(new URL("/login", request.url), 307);
  if (pageLoad && isCatalogPath(pathname)) {
    const redirect = await catalogRedirect(request);
    if (redirect) return redirect;
  }
  if (PRIVATE_SEGMENTS.has(first) || (request.method !== "GET" && request.method !== "HEAD")) return withNonce(request);
  return withPolicy(NextResponse.next(), shellPolicy(POLICY));
}

// The URL index from /api/url-index, kept for a minute per process. The first request after a start waits for it;
// later refreshes run in the background while the previous copy keeps answering. Without an index (the route failed),
// pages still resolve redirects themselves, only client-side.
// Fetched from the configured public URL (SITE_URL), never the request's origin: that comes from the Host header, and
// behind a proxy that passes it through, a forged Host would load an attacker's index and serve its redirects to every
// visitor for a minute. Preview deployments therefore use the production index. In development, the dev server itself.
const INDEX_TTL_MS = 60_000;
const INDEX_RETRY_MS = 10_000;
let urlIndex: UrlIndex | undefined;
let urlIndexAt = 0;
let loading: Promise<void> | undefined;

async function loadUrlIndex(origin: string) {
  try {
    const response = await fetch(new URL("/api/url-index", origin), { cache: "no-store" });
    if (!response.ok) throw new Error(`status ${response.status}`);
    urlIndex = { paths: new Map((await response.json()) as [string, UrlTarget][]), conflicts: [] };
    urlIndexAt = Date.now();
  } catch (err) {
    urlIndexAt = Date.now() - INDEX_TTL_MS + INDEX_RETRY_MS;
    console.error("proxy: URL index unavailable", err);
  }
}

async function catalogRedirect(request: NextRequest) {
  if (Date.now() - urlIndexAt > INDEX_TTL_MS && !loading)
    loading = loadUrlIndex(DEV ? request.nextUrl.origin : siteUrl()).finally(() => (loading = undefined));
  if (!urlIndex && loading) await loading;
  if (!urlIndex) return undefined;
  // Client-side navigation adds _rsc; the redirect target doesn't keep it.
  const query = new URLSearchParams(request.nextUrl.search);
  query.delete("_rsc");
  const resolved = resolvePath(urlIndex, request.nextUrl.pathname, query.toString());
  // Same-site targets only, whatever the index says (the index checks merchants' redirects too).
  if (resolved.kind !== "redirect" || !isLocalPath(resolved.to)) return undefined;
  return NextResponse.redirect(new URL(resolved.to, request.url), resolved.permanent ? 308 : 307);
}

// A per-request page: Next puts the nonce from the request's CSP header on its scripts.
function withNonce(request: NextRequest) {
  const policy = noncePolicy(newNonce(), POLICY);
  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", policy);
  return withPolicy(NextResponse.next({ request: { headers } }), policy);
}

function withPolicy(response: NextResponse, policy: string) {
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

// Everything except Next's own assets and API routes.
export const config = {
  matcher: ["/((?!_next/|api/).*)"],
};
