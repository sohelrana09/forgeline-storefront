import { NextResponse, type NextRequest } from "next/server";

// Guests get the cached catalog: home, category, product and content pages without query parameters are rewritten
// to the cached copies in src/app/(cached)/g. Signed-in customers (company or personal prices), URLs with
// parameters (?sort, ?page, ?sku, ?q) and form posts (Server Actions) use the per-visitor pages in (shop).
// The ct_session cookie name matches SESSION_COOKIE in src/features/auth/session.ts (middleware can't import it:
// that module reads server-only secrets).
const SESSION_COOKIE = "ct_session";
const CATALOG = /^\/(?:$|c\/[^/]+$|p\/[^/]+$|pages\/[^/]+$)/;
// Client-side navigation adds _rsc; campaign tracking parameters don't change the page either.
const IGNORED_PARAM = /^(?:_rsc|utm_\w+|gclid|fbclid|msclkid)$/;
// The same URL answers guests (cached) and signed-in customers (personal prices). A CDN in front of the app must
// bypass its cache when ct_session is present: Next replaces any Vary header set here with its own.

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // The cached copies are only reachable through the rewrite: send direct visits to the public URL.
  if (pathname === "/g" || pathname.startsWith("/g/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(2) || "/";
    return NextResponse.redirect(url, 308);
  }

  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();
  if (!CATALOG.test(pathname)) return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  // Any other parameter means a variant page (?sort, ?page, ?sku).
  if ([...searchParams.keys()].some((k) => !IGNORED_PARAM.test(k))) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? "/g" : `/g${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/", "/c/:path*", "/p/:path*", "/pages/:path*", "/g", "/g/:path*"],
};
