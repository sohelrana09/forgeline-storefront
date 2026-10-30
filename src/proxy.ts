import { NextResponse, type NextRequest } from "next/server";
import { RESERVED_SEGMENTS } from "@/lib/urls";
import { newNonce, noncePolicy, shellPolicy, studioPolicy } from "@/lib/csp";
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
  // Catalog URLs are lowercase (urlKey). Redirecting other casings before the page cache matters: a cached redirect
  // for "/Excavators" would overwrite the "/excavators" shell on a case-insensitive disk (macOS) and loop.
  if (request.method === "GET" && isCatalogPath(pathname) && pathname !== pathname.toLowerCase()) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.toLowerCase();
    return NextResponse.redirect(url, 308);
  }
  if (pathname.startsWith("/studio")) return withPolicy(NextResponse.next(), studioPolicy());
  const first = pathname.split("/")[1] ?? "";
  const read = request.method === "GET" || request.method === "HEAD";
  if (read && first === "account" && !request.cookies.has(SESSION_COOKIE))
    return NextResponse.redirect(new URL("/login", request.url), 307);
  if (read && isCatalogPath(pathname)) {
    const redirect = await catalogRedirect(request);
    if (redirect) return redirect;
  }
  if (PRIVATE_SEGMENTS.has(first) || (request.method !== "GET" && request.method !== "HEAD")) return withNonce(request);
  return withPolicy(NextResponse.next(), shellPolicy(DEV));
}

// The URL index from /api/url-index, kept for a minute per process. The first request after a start waits for it;
// later refreshes run in the background while the previous copy keeps answering. Without an index (the route failed),
// pages still resolve redirects themselves, only client-side.
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
    loading = loadUrlIndex(request.nextUrl.origin).finally(() => (loading = undefined));
  if (!urlIndex && loading) await loading;
  if (!urlIndex) return undefined;
  // Client-side navigation adds _rsc; the redirect target doesn't keep it.
  const query = new URLSearchParams(request.nextUrl.search);
  query.delete("_rsc");
  const resolved = resolvePath(urlIndex, request.nextUrl.pathname, query.toString());
  if (resolved.kind !== "redirect") return undefined;
  return NextResponse.redirect(new URL(resolved.to, request.url), resolved.permanent ? 308 : 307);
}

// A per-request page: Next puts the nonce from the request's CSP header on its scripts.
function withNonce(request: NextRequest) {
  const policy = noncePolicy(newNonce(), DEV);
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
