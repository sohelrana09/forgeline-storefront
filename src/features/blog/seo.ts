import type { Metadata } from "next";
import { stegaClean } from "next-sanity";
import { siteUrl } from "@/lib/site-url";
import { imageUrl } from "@/lib/sanity/image";
import type { Post } from "@/features/blog/types";
import { BLOG_PATH, postPath } from "@/features/blog/utils";

// Blog SEO: metadata with canonical and Open Graph, and BlogPosting structured data (schema.org).

export function postMetadata(post: Post): Metadata {
  const title = stegaClean(post.seo?.title || post.title);
  const description = stegaClean(post.seo?.description || post.excerpt);
  const image = post.coverImage?.asset ? imageUrl(post.coverImage, 1200, 630) : undefined;
  return {
    title,
    description,
    alternates: { canonical: postPath(stegaClean(post.slug)) },
    openGraph: {
      type: "article",
      title,
      description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      ...(image && { images: [{ url: image, width: 1200, height: 630 }] }),
    },
  };
}

export function postJsonLd(post: Post) {
  const url = `${siteUrl()}${postPath(stegaClean(post.slug))}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: stegaClean(post.title),
    description: stegaClean(post.excerpt),
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: url,
    url,
    ...(post.coverImage?.asset && { image: imageUrl(post.coverImage, 1200, 630) }),
    ...(post.author && { author: { "@type": "Person", name: stegaClean(post.author.name) } }),
    publisher: { "@type": "Organization", name: "Ironline Supply", url: siteUrl() },
    isPartOf: { "@type": "Blog", url: `${siteUrl()}${BLOG_PATH}` },
    keywords: post.tags.map((t) => stegaClean(t)).join(", ") || undefined,
  };
}
