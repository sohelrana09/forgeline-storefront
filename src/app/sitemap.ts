import type { MetadataRoute } from "next";
import { siteIndexable, siteUrl } from "@/lib/site-url";
import { allProductSlugs, getCategoryTree } from "@/features/catalog/service";
import { categoryHref } from "@/features/catalog/utils";
import { pagePath, productPath } from "@/lib/urls";
import { getPages } from "@/features/cms/service";
import { getGuestContext } from "@/features/business-units/service";

// The public catalog for search engines: home, every category, every product, every active content page.
// Regenerated at most once an hour.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!siteIndexable()) return []; // not listed while the site stays out of search engines
  const base = siteUrl();
  const [tree, products, pages] = await Promise.all([
    getCategoryTree(),
    getGuestContext().then(allProductSlugs),
    getPages().catch(() => []),
  ]);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    ...tree.all.map((c) => ({
      url: `${base}${categoryHref([...tree.ancestors(c), c])}`,
      lastModified: c.lastModifiedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...products.map((p) => ({
      url: `${base}${productPath(p.slug)}`,
      lastModified: p.lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...pages
      .filter((p) => p.active)
      .map((p) => ({ url: `${base}${pagePath(p.slug)}`, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}
