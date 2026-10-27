import { NextResponse, type NextRequest } from "next/server";
import { RESERVED_SEGMENTS } from "@/lib/urls";

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

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // The cached copies are only reachable through the rewrite: send direct visits to the public URL.
  if (pathname === "/g" || pathname.startsWith("/g/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(2) || "/";
    return NextResponse.redirect(url, 308);
  }

  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();
  if (!isCatalogPath(pathname)) return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  // Draft mode (the Studio's preview): the per-visitor page reads drafts; the cached copy can't.
  if (request.cookies.has(DRAFT_MODE_COOKIE)) return NextResponse.next();
  // Any other parameter means a variant page (?sort, ?page, ?sku).
  if ([...searchParams.keys()].some((k) => !IGNORED_PARAM.test(k))) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? "/g" : `/g${pathname}`;
  return NextResponse.rewrite(url);
}

// Everything except Next's own assets and API routes; isCatalogPath decides the rest.
export const config = {
  matcher: ["/((?!_next/|api/).*)"],
};
