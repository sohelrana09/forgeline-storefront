import type { PostFilter } from "@/features/blog/types";

// Blog URLs (Magefan style): /blog, /blog/<post>, /blog/category/<slug>, /blog/tag/<tag>, ?page=N for later pages.
export const BLOG_PATH = "/blog";
export const postPath = (slug: string) => `${BLOG_PATH}/${slug}`;
export const blogCategoryPath = (slug: string) => `${BLOG_PATH}/category/${slug}`;
export const blogTagPath = (tag: string) => `${BLOG_PATH}/tag/${tag}`;

export const listPath = ({ category, tag }: PostFilter, page = 1) => {
  const base = category ? blogCategoryPath(category) : tag ? blogTagPath(tag) : BLOG_PATH;
  return page > 1 ? `${base}?page=${page}` : base;
};

// URL keys and tags: lowercase letters, digits and hyphens (also what the Studio accepts).
export const isUrlKey = (value: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);

export const pageNumber = (value?: string) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 1000) : 1;
};

// Tags with their post counts, most used first.
export function tagCounts(tags: string[][]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of tags.flat()) if (isUrlKey(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export const formatPostDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
