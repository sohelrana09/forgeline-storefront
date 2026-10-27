import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { siteUrl } from "@/lib/site-url";
import { hasRevalidateSecret, merchantCenterUser } from "@/lib/revalidate-auth";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { forgetCatalogCache } from "@/features/catalog/service";
import { forgetContentCache } from "@/features/cms/service";
import { forgetUrlIndex } from "@/features/urls/service";
import { forgetSanityCache } from "@/lib/sanity/client";

// Refreshes the cached guest pages (src/app/(cached)/g) after content or catalog changes made outside the app:
// `npm run ct:content`, the Merchant Center Content app, Sanity's publish webhook (pages and blog; send
// { "scope": "content" }) and commercetools Subscriptions for prices and products.
//
// Body (all optional): { "scope": "content" | "catalog" | "all" }, or a commercetools message as delivered by a
// Subscription (directly, wrapped in EventBridge's { detail }, or in a Pub/Sub push { message: { data } }).
// Cached pages are marked stale (each re-renders on its next visit) and the in-process data memos are cleared,
// so the re-render reads fresh data. Signed-in pages render per request and need nothing.
type Scope = "content" | "catalog" | "all";

// An import sends one event per changed price or product. Calls within 10 s of the last purge are folded into it:
// the purged pages re-render on their next visit, which usually comes after the burst; at worst a change shows at
// the next 5-minute regeneration.
const COALESCE_MS = 10 * 1000;
let lastPurge = 0;

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const caller = hasRevalidateSecret(authorization)
    ? "secret"
    : await merchantCenterUser(authorization, `${siteUrl()}/api/revalidate`).then((user) => user && `mc:${user}`);
  if (!caller) {
    // Throttle guessing; authorized callers aren't counted.
    if (await tooManyAttempts(`revalidate:${await clientIp()}`, 20))
      return NextResponse.json({ error: "too many attempts" }, { status: 429 });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const scope = scopeOf(await request.json().catch(() => undefined));
  if (Date.now() - lastPurge < COALESCE_MS) return NextResponse.json({ revalidated: false, scope, reason: "coalesced" });
  lastPurge = Date.now();
  if (scope !== "catalog") {
    forgetContentCache();
    forgetSanityCache();
  }
  if (scope !== "content") forgetCatalogCache();
  // Products, categories and content pages are all in the URL index (new, renamed or removed URLs).
  forgetUrlIndex();
  // Content blocks appear on the home and category pages, and prices on every catalog page: purge all of them.
  revalidatePath("/(cached)/g", "layout");
  console.info("revalidated cached guest pages", { scope, caller });
  return NextResponse.json({ revalidated: true, scope });
}

function scopeOf(body: unknown): Scope {
  if (!body || typeof body !== "object") return "all";
  const b = body as {
    scope?: unknown;
    detail?: unknown;
    message?: { data?: unknown };
    resource?: { typeId?: unknown };
  };
  if (b.scope === "content" || b.scope === "catalog" || b.scope === "all") return b.scope;
  if (b.detail) return scopeOf(b.detail);
  if (typeof b.message?.data === "string") {
    try {
      return scopeOf(JSON.parse(Buffer.from(b.message.data, "base64").toString("utf8")));
    } catch {
      return "all";
    }
  }
  // Custom Objects are "key-value-document"s; everything else we subscribe to is catalog data.
  if (typeof b.resource?.typeId === "string") return b.resource.typeId === "key-value-document" ? "content" : "catalog";
  return "all";
}
