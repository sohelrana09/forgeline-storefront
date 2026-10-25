// Content (Magento-style CMS pages and static blocks), stored in commercetools Custom Objects:
//   container "cms-block", key = identifier  → CmsBlock
//   container "cms-page",  key = url slug    → CmsPage
// Pages and components only use the functions below, so swapping the backend for a headless CMS
// (Contentful, Storyblok, …) means rewriting this file, nothing else.
import { apiRoot } from "@/lib/commercetools/client";
import { staleWhileRevalidate } from "@/lib/memo";

import { BLOCK_CONTAINER, PAGE_CONTAINER, type BlockQuery, type CmsBlock, type CmsPage } from "@/features/cms/types";
import { isLive } from "@/features/cms/utils";

// Content changes far less often than it's read: refresh it at most every 60 seconds, in the background.
const memo = staleWhileRevalidate<unknown>(60 * 1000);
const cached = <T>(key: string, load: () => Promise<T>) => memo(key, load) as Promise<T>;

// After content was saved elsewhere (ct:content, the Merchant Center app): the next read loads it fresh.
export const forgetContentCache = () => memo.clear();

const allBlocks = () =>
  cached(BLOCK_CONTAINER, async () => {
    const { body } = await apiRoot.customObjects().withContainer({ container: BLOCK_CONTAINER }).get({ queryArgs: { limit: 500 } }).execute();
    return body.results.map((o) => ({ ...(o.value as CmsBlock), identifier: o.key }));
  });

export async function getBlocks({ placement, storeKey, categorySlugs = [] }: BlockQuery): Promise<CmsBlock[]> {
  const blocks = await allBlocks();
  return blocks
    .filter((b) => b.active && b.placement === placement && isLive(b))
    .filter((b) => !b.stores?.length || b.stores.includes(storeKey))
    .filter((b) => !b.categories?.length || b.categories.some((c) => categorySlugs.includes(c)))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export async function getPage(slug: string): Promise<CmsPage | undefined> {
  if (!/^[a-z0-9-]+$/.test(slug)) return undefined;
  const pages = await getPages();
  return pages.find((p) => p.slug === slug && p.active);
}

export const getPages = () =>
  cached(PAGE_CONTAINER, async () => {
    const { body } = await apiRoot.customObjects().withContainer({ container: PAGE_CONTAINER }).get({ queryArgs: { limit: 200 } }).execute();
    return body.results.map((o) => ({ ...(o.value as CmsPage), slug: o.key })).filter((p) => p.active);
  });
