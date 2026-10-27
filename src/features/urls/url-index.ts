import { categoryPath, normalizePath, pagePath, productPath, RESERVED_SEGMENTS, urlKey } from "@/lib/urls";

// The URL index (Magento's url_rewrite table): every storefront path and what it shows, plus the paths that redirect.
// Built from commercetools data by service.ts; pure, so it is unit-tested (url-index.test.ts).

export type UrlTarget =
  | { kind: "category"; id: string; slug: string }
  | { kind: "product"; slug: string }
  | { kind: "page"; slug: string }
  | { kind: "redirect"; to: string; permanent: boolean };

export type UrlSources = {
  // Categories with their slug trail from the top level down to themselves (raw commercetools slugs).
  categories: { id: string; trail: string[] }[];
  products: { slug: string }[];
  pages: { slug: string }[];
  // Merchant-defined redirects (Magento "custom URL rewrites"), e.g. a retired product to its successor.
  rewrites: { from: string; to: string; permanent: boolean }[];
};

export type UrlIndex = {
  paths: Map<string, UrlTarget>;
  // Paths that couldn't be used: reserved for the app, or already taken (first owner wins).
  conflicts: { path: string; wanted: string; reason: string }[];
};

export function buildUrlIndex({ categories, products, pages, rewrites }: UrlSources): UrlIndex {
  const paths = new Map<string, UrlTarget>();
  const conflicts: UrlIndex["conflicts"] = [];
  const describe = (t: UrlTarget) => (t.kind === "redirect" ? `redirect to ${t.to}` : `${t.kind} ${"slug" in t ? t.slug : ""}`.trim());

  const add = (rawPath: string, target: UrlTarget, { alias = false } = {}) => {
    const path = normalizePath(rawPath);
    const first = path.split("/")[1] ?? "";
    if (path === "/" || (RESERVED_SEGMENTS.has(first) && !alias)) {
      conflicts.push({ path, wanted: describe(target), reason: "reserved for the app" });
      return;
    }
    const owner = paths.get(path);
    if (owner) {
      // Aliases quietly give way to real URLs; two real URLs on one path are reported.
      if (!alias) conflicts.push({ path, wanted: describe(target), reason: `already used by ${describe(owner)}` });
      return;
    }
    paths.set(path, target);
  };

  // Order = priority: merchants' redirects first (they override), then categories, content pages, products.
  for (const r of rewrites) add(r.from, { kind: "redirect", to: r.to, permanent: r.permanent });
  for (const c of categories) add(categoryPath(c.trail), { kind: "category", id: c.id, slug: c.trail[c.trail.length - 1] });
  for (const p of pages) add(pagePath(p.slug), { kind: "page", slug: p.slug });
  for (const p of products) add(productPath(p.slug), { kind: "product", slug: p.slug });

  // Old addresses keep working (301): the /c/, /p/ and /pages/ URLs and the underscore spellings.
  const permanent = (to: string): UrlTarget => ({ kind: "redirect", to, permanent: true });
  for (const c of categories) {
    const slug = c.trail[c.trail.length - 1];
    const to = categoryPath(c.trail);
    add(`/c/${slug}`, permanent(to), { alias: true });
    add(`/${slug}`, permanent(to), { alias: true });
  }
  for (const p of pages) add(`/pages/${p.slug}`, permanent(pagePath(p.slug)), { alias: true });
  for (const p of products) {
    add(`/p/${p.slug}`, permanent(productPath(p.slug)), { alias: true });
    if (urlKey(p.slug) !== p.slug.toLowerCase()) add(`/${p.slug}`, permanent(productPath(p.slug)), { alias: true });
  }
  return { paths, conflicts };
}

export type Resolution =
  | { kind: "category"; id: string; slug: string }
  | { kind: "product"; slug: string }
  | { kind: "page"; slug: string }
  | { kind: "redirect"; to: string; permanent: boolean }
  | { kind: "missing" };

// What a requested path shows. A path that only differs in case or slashes redirects to its canonical spelling; a
// redirect keeps the query string (filters, ?sku=) unless its target brings its own.
export function resolvePath(index: UrlIndex, requested: string, query = ""): Resolution {
  const path = normalizePath(requested);
  const target = index.paths.get(path);
  const withQuery = (to: string) => (query && !to.includes("?") ? `${to}?${query}` : to);
  if (!target) return { kind: "missing" };
  if (target.kind === "redirect") return { kind: "redirect", to: withQuery(target.to), permanent: target.permanent };
  if (path !== requested.replace(/\/+$/, "") && requested !== "/") return { kind: "redirect", to: withQuery(path), permanent: true };
  return target;
}
