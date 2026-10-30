import { cacheLife, cacheTag } from "next/cache";

// Lifetimes and tags for "use cache" reads (Cache Components, E29). Every shared read tags itself so /api/revalidate
// can clear exactly what changed (a Subscription message, Sanity's publish webhook); the lifetimes are the fallback
// when no message arrives.
export const TAGS = {
  // Products, prices and product discounts: anything price-selected or assortment-dependent.
  catalog: "catalog",
  categories: "categories",
  // Sanity pages, blocks and the blog.
  content: "content",
  // The URL index (categories, products, pages, merchants' redirects).
  urls: "urls",
  // Business units, stores and channels (the guest context and the units' pricing).
  units: "units",
} as const;
export type CacheTag = (typeof TAGS)[keyof typeof TAGS];

// Price-selected reads: product discounts start and end by date, so they refresh within 15 minutes even without a
// message. Rarely changing structure (categories, units): an hour. Published Sanity content: a minute, because the
// publish webhook isn't set up on every deployment.
const LIFETIMES = {
  prices: { stale: 300, revalidate: 900, expire: 86_400 },
  structure: { stale: 300, revalidate: 3_600, expire: 86_400 },
  content: { stale: 60, revalidate: 60, expire: 86_400 },
} as const;

// Call first thing inside a "use cache" function. Outside Next (tsx scripts) the directive is a plain string and
// these helpers would throw, so they do nothing there and the read simply runs uncached.
export function cacheFor(lifetime: keyof typeof LIFETIMES, ...tags: CacheTag[]) {
  if (!process.env.NEXT_RUNTIME) return;
  cacheLife(LIFETIMES[lifetime]);
  if (tags.length) cacheTag(...tags);
}
