import "server-only";
import { apiRoot } from "@/lib/commercetools/client";
import { cacheFor, TAGS } from "@/lib/cache";
import { allProductSlugs, getCategoryTree } from "@/features/catalog/service";
import { localize } from "@/features/catalog/utils";
import { getPages } from "@/features/cms/service";
import { getGuestContext } from "@/features/business-units/service";
import { buildUrlIndex, resolvePath, type UrlIndex, type UrlSources } from "@/features/urls/url-index";
import { isLocalPath } from "@/lib/urls";

// The live URL index: categories (tree paths), products, active content pages and merchants' redirects. Cached and
// shared ("use cache"), rebuilt within 15 minutes, and at once when /api/revalidate reports a catalog or content change.
export const REWRITE_CONTAINER = "url-rewrite";
export type UrlRewrite = { from: string; to: string; permanent?: boolean };

export async function urlSources(): Promise<UrlSources> {
  const [tree, products, pages, rewrites] = await Promise.all([
    getCategoryTree(),
    getGuestContext().then(allProductSlugs),
    getPages().catch(() => []),
    apiRoot
      .customObjects()
      .withContainer({ container: REWRITE_CONTAINER })
      .get({ queryArgs: { limit: 500 } })
      .execute()
      .then((r) => r.body.results.map((o) => o.value as UrlRewrite))
      .catch(() => [] as UrlRewrite[]),
  ]);
  return {
    categories: tree.all.map((c) => ({ id: c.id, trail: [...tree.ancestors(c), c].map((x) => localize(x.slug)) })),
    products: products.map((p) => ({ slug: p.slug })),
    pages: pages.filter((p) => p.active).map((p) => ({ slug: p.slug })),
    rewrites: rewrites
      .filter((r) => typeof r.from === "string" && typeof r.to === "string" && r.from.startsWith("/") && isLocalPath(r.to))
      .map((r) => ({ from: r.from, to: r.to, permanent: r.permanent !== false })),
  };
}

export async function getUrlIndex(): Promise<UrlIndex> {
  "use cache: remote";
  cacheFor("prices", TAGS.urls, TAGS.catalog, TAGS.categories, TAGS.content);
  const index = buildUrlIndex(await urlSources());
  for (const c of index.conflicts) console.warn(`URL ${c.path}: ${c.wanted} not used (${c.reason})`);
  return index;
}

export async function resolveUrl(segments: string[], query: URLSearchParams | string = "") {
  return resolvePath(await getUrlIndex(), `/${segments.join("/")}`, String(query));
}
