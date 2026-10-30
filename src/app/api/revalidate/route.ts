import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { hasRevalidateSecret } from "@/lib/revalidate-auth";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { forgetCatalogCache } from "@/features/catalog/service";
import { TAGS, type CacheTag } from "@/lib/cache";

// Refreshes the cached reads behind every page ("use cache" tags, src/lib/cache.ts) after content or catalog changes
// made outside the app:
// Sanity's publish webhook (pages, blocks and blog; sends { "scope": "content" }) and commercetools Subscriptions for
// prices, products and Custom Objects (merchants' redirects). Authorized by `Authorization: Bearer <REVALIDATE_SECRET>`.
//
// Body (all optional): { "scope": "content" | "catalog" | "all" }, or a commercetools message as delivered by a
// Subscription (directly, wrapped in EventBridge's { detail }, or in a Pub/Sub push { message: { data } }).
// The tags of the changed data expire at once, so the next visit reads it fresh, and pages built from it (the static
// shells) are rebuilt; the in-process search index is cleared too.
type Scope = "content" | "catalog" | "all";

// An import sends one event per changed price or product, and every call is applied: expiring tags is cheap (the reads
// reload once, on their next use), while skipping a call left its change stale for the read's whole lifetime.

export async function POST(request: NextRequest) {
  if (!hasRevalidateSecret(request.headers.get("authorization"))) {
    // Throttle guessing; authorized callers aren't counted.
    if (await tooManyAttempts(`revalidate:${await clientIp()}`, 20))
      return NextResponse.json({ error: "too many attempts" }, { status: 429 });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const scope = scopeOf(await request.json().catch(() => undefined));
  if (scope !== "content") forgetCatalogCache();
  for (const tag of tagsFor(scope)) revalidateTag(tag, { expire: 0 });
  console.info("revalidated cached reads", { scope, tags: tagsFor(scope) });
  return NextResponse.json({ revalidated: true, scope });
}

// Products, categories and content pages are all in the URL index (new, renamed or removed URLs). Custom Objects are
// merchants' redirects, which only the URL index uses.
function tagsFor(scope: Scope): CacheTag[] {
  const catalog: CacheTag[] = [TAGS.catalog, TAGS.categories, TAGS.units];
  if (scope === "content") return [TAGS.content, TAGS.urls];
  if (scope === "catalog") return [...catalog, TAGS.urls];
  return [...catalog, TAGS.content, TAGS.urls];
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
