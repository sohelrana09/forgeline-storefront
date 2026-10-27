import "server-only";
import { isDraftMode, sanityFetch } from "@/lib/sanity/client";
import { sanityConfigured } from "@/lib/sanity/env";
import { POSTS_PER_PAGE, type BlogCategory, type Post, type PostFilter, type PostPage, type PostSummary } from "@/features/blog/types";
import { isUrlKey, tagCounts } from "@/features/blog/utils";

// Blog reads (GROQ against Sanity). A post is public from its publish date on; the Studio's preview also shows
// drafts and scheduled posts. Lists, categories, tags, the sitemap and the feed read published content only.

export const blogEnabled = () => sanityConfigured;

const LIVE = `_type == "post" && defined(slug.current) && publishedAt <= now()`;
const SUMMARY = `title, "slug": slug.current, publishedAt, excerpt, coverImage,
  "author": author->{name, role, image},
  "categories": coalesce(categories[]->{title, "slug": slug.current}, []),
  "tags": coalesce(tags, [])`;

// Every query below is memoized by its parameters, so only known categories and tags and existing pages reach
// Sanity: made-up URLs (/blog/tag/a1, a2, …, ?page=999) can't grow the cache or spend the API quota.
export async function getPosts(filter: PostFilter, page: number): Promise<PostPage> {
  const none = { posts: [], total: 0 };
  if (filter.category && !(await getBlogCategories()).some((c) => c.slug === filter.category)) return none;
  if (filter.tag && !(await getTags()).some((t) => t.tag === filter.tag)) return none;
  const where = `${LIVE}${filter.category ? " && $category in categories[]->slug.current" : ""}${filter.tag ? " && $tag in tags" : ""}`;
  const params = { category: filter.category ?? "", tag: filter.tag ?? "" };
  const total = await sanityFetch<number>(`count(*[${where}])`, params, { drafts: false });
  if (page > Math.max(1, Math.ceil(total / POSTS_PER_PAGE))) return { posts: [], total };
  const from = (page - 1) * POSTS_PER_PAGE;
  const posts = await sanityFetch<PostSummary[]>(
    `*[${where}] | order(publishedAt desc) [$from...$to]{${SUMMARY}}`,
    { ...params, from, to: from + POSTS_PER_PAGE },
    { drafts: false },
  );
  return { posts, total };
}

// One post with its content. In the Studio's preview: drafts too, and scheduled posts before their date.
export async function getPost(slug: string): Promise<Post | undefined> {
  if (!isUrlKey(slug)) return undefined;
  const post = await sanityFetch<Post | null>(
    `*[_type == "post" && slug.current == $slug && (publishedAt <= now() || $preview)][0]{${SUMMARY}, "updatedAt": _updatedAt, body, products, seo}`,
    { slug, preview: await isDraftMode() },
  );
  return post ?? undefined;
}

export const getBlogCategories = () =>
  sanityFetch<BlogCategory[]>(
    `*[_type == "blogCategory" && defined(slug.current)] | order(title asc){title, "slug": slug.current, description,
      "count": count(*[${LIVE} && references(^._id)])}`,
    {},
    { drafts: false },
  );

export async function getBlogCategory(slug: string): Promise<BlogCategory | undefined> {
  if (!isUrlKey(slug)) return undefined;
  const categories = await getBlogCategories();
  return categories.find((c) => c.slug === slug);
}

export async function getTags() {
  return tagCounts(await sanityFetch<string[][]>(`*[${LIVE}].tags`, {}, { drafts: false }).then((t) => t.filter(Array.isArray)));
}

export const getRecentPosts = (limit = 5) =>
  sanityFetch<PostSummary[]>(`*[${LIVE}] | order(publishedAt desc) [0...$limit]{${SUMMARY}}`, { limit }, { drafts: false });

export const getAllPosts = () =>
  sanityFetch<(PostSummary & { updatedAt: string })[]>(
    `*[${LIVE}] | order(publishedAt desc){${SUMMARY}, "updatedAt": _updatedAt}`,
    {},
    { drafts: false },
  );
