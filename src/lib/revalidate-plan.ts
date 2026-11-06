import { TAGS, type CacheTag } from "@/lib/cache";

// What one call to /api/revalidate has to refresh. Pure, unit-tested.
// A commercetools message names one changed resource, so it expires only the reads that resource is in: a price import
// must not rebuild categories, the URL index and every shell. Messages are `debounced`: an import sends thousands, and
// each expiry costs a rebuild. An explicit { scope } (Sanity's webhook, a person) applies at once.
export type Plan = { tags: CacheTag[]; debounced: boolean; catalog: boolean };

const SCOPES: Record<string, CacheTag[]> = {
  content: [TAGS.content, TAGS.urls],
  catalog: [TAGS.catalog, TAGS.categories, TAGS.units, TAGS.urls],
  all: [TAGS.catalog, TAGS.categories, TAGS.units, TAGS.content, TAGS.urls],
};

const RESOURCES: Record<string, CacheTag[]> = {
  "standalone-price": [TAGS.catalog],
  "product-discount": [TAGS.catalog],
  product: [TAGS.catalog, TAGS.urls],
  category: [TAGS.categories, TAGS.urls, TAGS.catalog],
};

const REDIRECTS_CONTAINER = "url-rewrite";

type Body = {
  scope?: unknown;
  detail?: unknown;
  message?: { data?: unknown };
  resource?: { typeId?: unknown };
  resourceUserProvidedIdentifiers?: { containerAndKey?: { container?: unknown } };
};

const plan = (tags: CacheTag[], debounced: boolean): Plan => ({ tags, debounced, catalog: tags.includes(TAGS.catalog) });

// The body directly, wrapped in EventBridge's { detail }, or in a Pub/Sub push { message: { data } }.
export function planFor(body: unknown): Plan {
  if (!body || typeof body !== "object") return plan(SCOPES.all, false);
  const b = body as Body;
  if (typeof b.scope === "string" && SCOPES[b.scope]) return plan(SCOPES[b.scope], false);
  if (b.detail) return planFor(b.detail);
  if (typeof b.message?.data === "string") {
    try {
      return planFor(JSON.parse(Buffer.from(b.message.data, "base64").toString("utf8")));
    } catch {
      return plan(SCOPES.all, false);
    }
  }
  const type = b.resource?.typeId;
  if (typeof type !== "string") return plan(SCOPES.all, false);
  if (type === "key-value-document") {
    // Custom Objects hold order markers and sessions too: only merchants' redirects are in the URL index. Without the
    // container in the message, refresh the index to be safe.
    const container = b.resourceUserProvidedIdentifiers?.containerAndKey?.container;
    return plan(container === undefined || container === REDIRECTS_CONTAINER ? [TAGS.urls] : [], true);
  }
  return plan(RESOURCES[type] ?? SCOPES.catalog, true);
}
