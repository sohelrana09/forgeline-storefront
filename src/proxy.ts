import { NextResponse, type NextRequest } from "next/server";
import { RESERVED_SEGMENTS } from "@/lib/urls";
import { cachedPagePolicy, newNonce, noncePolicy, studioPolicy } from "@/lib/csp";

// Guests get the cached catalog: home and every catalog URL (category paths, products, content pages; see
// src/lib/urls.ts) without query parameters are rewritten to the cached copies in src/app/(cached)/g. Signed-in customers (company or personal prices), URLs with
// parameters (?sort, ?page, ?sku, ?q) and form posts (Server Actions) use the per-visitor pages in (shop).
// The ct_session cookie name matches SESSION_COOKIE in src/features/auth/session.ts (the proxy can't import it:
// that module reads server-only secrets).
const SESSION_COOKIE = "ct_session";
// Set by draftMode().enable() (src/app/api/draft-mode/enable).
const DRAFT_MODE_COOKIE = "__prerender_bypass";
// Not catalog pages: the app's own routes, the old /c/, /p/ and /pages/ URLs (they redirect from the per-visitor
// route), files (catalog URL keys never contain a dot) and BotID's challenge path.
const OLD_PREFIXES = new Set(["c", "p", "pages"]);
const BOTID_PREFIX = "149e9513-01fa-4fb0-aad4-566afd725d1b";
const isCatalogPath = (pathname: string) => {
  if (pathname === "/") return true;
  const first = pathname.split("/")[1] ?? "";
  return !pathname.includes(".") && !RESERVED_SEGMENTS.has(first) && !OLD_PREFIXES.has(first) && first !== BOTID_PREFIX;
};
// Client-side navigation adds _rsc; campaign tracking parameters don't change the page either.
const IGNORED_PARAM = /^(?:_rsc|utm_\w+|gclid|fbclid|msclkid)$/;
// The same URL answers guests (cached) and signed-in customers (personal prices). A CDN in front of the app must
// bypass its cache when ct_session is present: Next replaces any Vary header set here with its own.
const DEV = process.env.NODE_ENV !== "production";

// Every page also gets its Content-Security-Policy here (src/lib/csp.ts): cached guest copies a fixed one, everything
// else a per-response nonce.
export function proxy(request: NextRequest) {
  const response = route(request);
  if (!response.headers.has("Content-Security-Policy")) {
    response.headers.set(
      "Content-Security-Policy",
      request.nextUrl.pathname.startsWith("/studio") ? studioPolicy() : cachedPagePolicy(DEV),
    );
  }
  return response;
}

// A per-visitor page: Next puts the nonce from the request's CSP header on its scripts.
function withNonce(request: NextRequest) {
  const policy = noncePolicy(newNonce(), DEV);
  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

function route(request: NextRequest): NextResponse {
  const { pathname, searchParams } = request.nextUrl;

  // The cached copies are only reachable through the rewrite: send direct visits to the public URL.
  if (pathname === "/g" || pathname.startsWith("/g/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(2) || "/";
    return NextResponse.redirect(url, 308);
  }

  // The Studio is built statically, so it can't carry a nonce: it gets the fixed policy in proxy().
  if (pathname.startsWith("/studio")) return NextResponse.next();
  if (request.method !== "GET" && request.method !== "HEAD") return withNonce(request);
  if (!isCatalogPath(pathname)) return withNonce(request);
  // Catalog URLs are lowercase (urlKey). Redirecting other casings before the cache matters: a cached redirect for
  // "/Excavators" would overwrite the "/excavators" page on a case-insensitive disk (macOS) and loop.
  if (pathname !== pathname.toLowerCase()) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.toLowerCase();
    return NextResponse.redirect(url, 308);
  }
  if (request.cookies.has(SESSION_COOKIE)) return withNonce(request);
  // Draft mode (the Studio's preview): the per-visitor page reads drafts; the cached copy can't.
  if (request.cookies.has(DRAFT_MODE_COOKIE)) return withNonce(request);
  if ([...searchParams.keys()].some((k) => !IGNORED_PARAM.test(k))) return withNonce(request);

  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? "/g" : `/g${pathname}`;
  return NextResponse.rewrite(url);
}

// Everything except Next's own assets and API routes; isCatalogPath decides the rest.
export const config = {
  matcher: ["/((?!_next/|api/).*)"],
};
