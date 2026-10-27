import type { PortableTextBlock } from "next-sanity";
import type { SanityImage } from "@/lib/sanity/image";

// Blog model (Sanity documents "post", "author", "blogCategory"; schemas in src/studio/schemaTypes).

export const POSTS_PER_PAGE = 9;

export type BlogCategory = { title: string; slug: string; description?: string; count?: number };

export type PostSummary = {
  title: string;
  slug: string;
  publishedAt: string;
  excerpt?: string;
  coverImage?: SanityImage;
  author?: { name: string; role?: string; image?: SanityImage };
  categories: BlogCategory[];
  tags: string[];
};

export type Post = PostSummary & {
  updatedAt: string;
  body?: PortableTextBlock[];
  products?: { _key?: string; sku?: string }[];
  seo?: { title?: string; description?: string };
};

export type PostFilter = { category?: string; tag?: string };
export type PostPage = { posts: PostSummary[]; total: number };
