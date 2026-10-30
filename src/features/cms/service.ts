// Content: pages ("page") and blocks ("cmsBlock") are Sanity documents; without Sanity configured there are none.
// Pages and components only use the functions below, so swapping the backend for a headless CMS
// (Contentful, Storyblok, …) means rewriting this file, nothing else.
import "server-only";
import { sanityFetch } from "@/lib/sanity/client";
import { stegaClean } from "next-sanity";
import { sanityConfigured } from "@/lib/sanity/env";

import type { BlockQuery, CmsBlock, CmsPage } from "@/features/cms/types";
import { isLive } from "@/features/cms/utils";

// In the Studio's preview, strings carry invisible edit markers: values used for filtering, links and pictures are
// cleaned; visible text keeps them for click-to-edit.
const BLOCK_FIELDS = `"identifier": identifier.current, title, "active": coalesce(active, true), placement, sortOrder, style,
  stores, categories, startsAt, endsAt, "type": select(kind == "products" => "products", kind == "banner" => "banner", "text"),
  body, "skus": products[].sku, cta{label, href}, secondaryCta{label, href}, headline, "content": text,
  "image": image.asset->url, "imageAlt": image.alt, "mobileImage": mobileImage.asset->url, theme`;

// GROQ answers null for empty fields; the block code (and isLive's schedule) expects them left out.
const withoutNulls = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null)) as T;

const cleanBlock = (raw: CmsBlock): CmsBlock => {
  const b = withoutNulls(raw);
  return {
    ...b,
    ...stegaClean({
      identifier: b.identifier,
      placement: b.placement,
      style: b.style,
      stores: b.stores,
      categories: b.categories,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      type: b.type,
      skus: b.skus,
      image: b.image,
      mobileImage: b.mobileImage,
      theme: b.theme,
    }),
    cta: b.cta && { ...b.cta, href: stegaClean(b.cta.href) },
    secondaryCta: b.secondaryCta && { ...b.secondaryCta, href: stegaClean(b.secondaryCta.href) },
  };
};

const allBlocks = (): Promise<CmsBlock[]> =>
  sanityConfigured
    ? sanityFetch<CmsBlock[]>(`*[_type == "cmsBlock" && defined(identifier.current)]{${BLOCK_FIELDS}}`).then((all) => all.map(cleanBlock))
    : Promise.resolve([]);

export async function getBlocks({ placement, storeKey, categorySlugs = [] }: BlockQuery): Promise<CmsBlock[]> {
  const blocks = await allBlocks();
  return blocks
    .filter((b) => b.active && b.placement === placement && isLive(b))
    .filter((b) => !b.stores?.length || b.stores.includes(storeKey))
    .filter((b) => !b.categories?.length || b.categories.some((c) => categorySlugs.includes(c)))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

const PAGE_FIELDS = `"slug": slug.current, title, "metaTitle": seo.title, "metaDescription": seo.description, "active": true`;

// One page, drafts included in the Studio's preview.
export async function getPage(slug: string): Promise<CmsPage | undefined> {
  if (!/^[a-z0-9-]+$/.test(slug)) return undefined;
  if (!sanityConfigured) return undefined;
  const page = await sanityFetch<CmsPage | null>(`*[_type == "page" && slug.current == $slug][0]{${PAGE_FIELDS}, body}`, { slug });
  return page ?? undefined;
}

// Published pages only (URL index, sitemap, footer: shared between visitors, so never drafts).
export const getPages = (): Promise<CmsPage[]> =>
  sanityConfigured
    ? sanityFetch<CmsPage[]>(`*[_type == "page" && defined(slug.current)] | order(title asc){${PAGE_FIELDS}}`, {}, { drafts: false })
    : Promise.resolve([]);
