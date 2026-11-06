import { after, NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { hasRevalidateSecret } from "@/lib/revalidate-auth";
import { acquireLock, clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { forgetCatalogCache } from "@/features/catalog/service";
import { planFor } from "@/lib/revalidate-plan";
import { SIGNATURE_HEADER, validSanitySignature } from "@/lib/sanity/webhook-signature";

// Refreshes the cached reads behind every page ("use cache" tags, src/lib/cache.ts) after content or catalog changes
// made outside the app:
// Sanity's publish webhook (pages, blocks and blog; sends { "scope": "content" }) and commercetools Subscriptions for
// prices, products and Custom Objects (merchants' redirects). Authorized by `Authorization: Bearer <REVALIDATE_SECRET>`.
//
// Body (all optional): { "scope": "content" | "catalog" | "all" }, or a commercetools message as delivered by a
// Subscription (directly, wrapped in EventBridge's { detail }, or in a Pub/Sub push { message: { data } }).
// The tags of the changed data expire (src/lib/revalidate-plan.ts decides which, and when), so the next visit reads it
// fresh, and pages built from it (the static shells) are rebuilt; the in-process search index is cleared too.
const DEBOUNCE_MS = 30_000;
export const maxDuration = 45;

function parseBody(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  // Sanity's signature when it sent one and a secret is set; a bearer token for everyone else.
  const signature = request.headers.get(SIGNATURE_HEADER);
  const secret = process.env.SANITY_WEBHOOK_SECRET;
  const authorized =
    signature && secret
      ? validSanitySignature(signature, raw, secret, Date.now())
      : hasRevalidateSecret(request.headers.get("authorization"));
  if (!authorized) {
    // Throttle guessing; authorized callers aren't counted.
    if (await tooManyAttempts(`revalidate:${await clientIp()}`, 20))
      return NextResponse.json({ error: "too many attempts" }, { status: 429 });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const plan = planFor(parseBody(raw));
  if (plan.tags.length === 0) return NextResponse.json({ ignored: true });
  const expire = () => {
    if (plan.catalog) forgetCatalogCache();
    for (const tag of plan.tags) revalidateTag(tag, { expire: 0 });
    console.info("revalidated cached reads", plan);
  };
  if (!plan.debounced) {
    expire();
    return NextResponse.json({ revalidated: true, tags: plan.tags });
  }
  // The first message of a burst waits for the rest, then expires once; the others stop here. A message after the wait
  // starts the next round, so the last change of an import is always covered.
  if (!(await acquireLock(`revalidate:${plan.tags.join(",")}`, DEBOUNCE_MS))) return NextResponse.json({ debounced: true });
  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS));
    expire();
  });
  return NextResponse.json({ scheduled: true, tags: plan.tags });
}
