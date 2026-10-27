import type { MetadataRoute } from "next";
import { siteIndexable, siteUrl } from "@/lib/site-url";
import { allProductSlugs, getCategoryTree } from "@/features/catalog/service";
import { categoryHref } from "@/features/catalog/utils";
import { pagePath, productPath } from "@/lib/urls";
import { getPages } from "@/features/cms/service";
import { getGuestContext } from "@/features/business-units/service";
import { blogEnabled, getAllPosts, getBlogCategories } from "@/features/blog/service";
import { BLOG_PATH, blogCategoryPath, postPath } from "@/features/blog/utils";

// The public catalog for search engines: home, every category, every product, every active content page, and the
// blog (list, categories with posts, published posts).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!siteIndexable()) return [];
  const base = siteUrl();
  const blog = blogEnabled();
  const [tree, products, pages, posts, blogCategories] = await Promise.all([
    getCategoryTree(),
    getGuestContext().then(allProductSlugs),
    getPages().catch(() => []),
    blog ? getAllPosts().catch(() => []) : [],
    blog ? getBlogCategories().catch(() => []) : [],
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
    ...(blog ? [{ url: `${base}${BLOG_PATH}`, changeFrequency: "daily" as const, priority: 0.5 }] : []),
    ...blogCategories
      .filter((c) => c.count)
      .map((c) => ({ url: `${base}${blogCategoryPath(c.slug)}`, changeFrequency: "weekly" as const, priority: 0.4 })),
    ...posts.map((p) => ({
      url: `${base}${postPath(p.slug)}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
