import "server-only";
import { cache } from "react";
import type { Category, ProductProjection } from "@commercetools/platform-sdk";
import { apiRoot } from "@/lib/commercetools/client";
import { staleWhileRevalidate } from "@/lib/memo";
import { cacheFor, TAGS } from "@/lib/cache";
import { priceSelection, pricingKey, pricingKeyId, type PricingKey } from "@/features/catalog/pricing";
import { allVariants, categoryHref, localize, LOCALE, specRows } from "@/features/catalog/utils";
import { codeWords, rank, words, type SearchEntry } from "@/features/catalog/search";
import { productSearchEnabled, productSearchRequest } from "@/features/catalog/product-search";

// Catalog reads with the admin client, price-selected for the buyer's store/channel/country.
// Price-selected reads take only a PricingKey (features/catalog/pricing.ts): each exported read turns the buying
// context into its key and hands just that to an inner "use cache" read, so entries are shared per store and price
// list and nothing about the person can reach the cache. Refreshed within 15 minutes, or when /api/revalidate clears
// the catalog tag.

// ---------- Categories (42 in the sample data; products are assigned to leaf categories only) ----------

export type CategoryTree = {
  all: Category[];
  roots: Category[];
  bySlug: (slug: string) => Category | undefined;
  children: (id: string) => Category[];
  ancestors: (category: Category) => Category[];
  // The category plus every descendant: product queries need all of them because parents hold no products.
  subtreeIds: (id: string) => string[];
};

// The search index changes rarely: refresh it every 5 minutes in the background.
const TTL_MS = 5 * 60 * 1000;

// The categories themselves are cached and shared (an hour, or until a category changes); the tree with its lookup
// functions is built from them once per render, since cached values must be plain data.
async function loadCategories(): Promise<Category[]> {
  "use cache: remote";
  cacheFor("structure", TAGS.categories);
  const { body } = await apiRoot
    .categories()
    .get({ queryArgs: { limit: 500, sort: ["orderHint asc", `name.${LOCALE} asc`] } })
    .execute();
  return body.results;
}

function buildCategoryTree(all: Category[]): CategoryTree {
  const byId = new Map(all.map((c) => [c.id, c]));
  const children = (id: string) => all.filter((c) => c.parent?.id === id);
  const subtreeIds = (id: string): string[] => [id, ...children(id).flatMap((c) => subtreeIds(c.id))];
  return {
    all,
    roots: all.filter((c) => !c.parent),
    bySlug: (slug) => all.find((c) => c.slug[LOCALE] === slug),
    children,
    ancestors: (category) => category.ancestors.map((a) => byId.get(a.id)).filter((c): c is Category => !!c),
    subtreeIds,
  };
}

export const getCategoryTree = cache(async () => buildCategoryTree(await loadCategories()));

// The storefront menu mirrors the Merchant Center category tree (same nesting, same orderHint order).
export type CategoryMenuItem = { id: string; label: string; href: string; children: CategoryMenuItem[] };

export function categoryMenu(tree: CategoryTree, maxDepth = 3): CategoryMenuItem[] {
  const build = (categories: Category[], depth: number, parents: Category[]): CategoryMenuItem[] =>
    categories.map((c) => ({
      id: c.id,
      label: localize(c.name),
      href: categoryHref([...parents, c]),
      children: depth < maxDepth ? build(tree.children(c.id), depth + 1, [...parents, c]) : [],
    }));
  return build(tree.roots, 1, []);
}

// ---------- Products ----------

// Ids come from commercetools (category tree, product references), never from user input.
const idList = (ids: string[]) => ids.map((id) => `"${id}"`).join(", ");

export function getProductsInCategories(
  ctx: PricingKey,
  categoryIds: string[],
  options: { limit?: number; offset?: number; sort?: string } = {},
) {
  return productsInCategories(pricingKey(ctx), categoryIds, options);
}

async function productsInCategories(
  key: PricingKey,
  categoryIds: string[],
  { limit = 24, offset = 0, sort = `name.${LOCALE} asc` }: { limit?: number; offset?: number; sort?: string },
) {
  "use cache: remote";
  cacheFor("prices", TAGS.catalog);
  const { body } = await apiRoot
    .productProjections()
    .get({
      queryArgs: {
        where: `categories(id in (${idList(categoryIds)}))`,
        limit,
        offset,
        sort: [sort],
        ...priceSelection(key),
      },
    })
    .execute();
  return body;
}

// Every product of a category subtree, price-selected for the visitor: the layered navigation (layered.ts) filters,
// counts, sorts and pages them itself, because Product Projection Search (and its facets) is deactivated here.
// Fine for catalogs of a few hundred products per category; past CATEGORY_MAX switch to the Product Search API.
export const CATEGORY_MAX = 500;
export const getAllProductsInCategories = cache((ctx: PricingKey, categoryIds: string[]) =>
  allProductsInCategories(pricingKey(ctx), categoryIds),
);

async function allProductsInCategories(key: PricingKey, categoryIds: string[]) {
  "use cache: remote";
  cacheFor("prices", TAGS.catalog);
  const { body } = await apiRoot
    .productProjections()
    .get({
      queryArgs: {
        where: `categories(id in (${idList(categoryIds)}))`,
        limit: CATEGORY_MAX,
        sort: [`name.${LOCALE} asc`],
        ...priceSelection(key),
      },
    })
    .execute();
  if ((body.total ?? 0) > CATEGORY_MAX)
    console.warn(`category has ${body.total} products; layered navigation sees the first ${CATEGORY_MAX}`);
  return body.results;
}

// React cache(): the page's metadata and the page itself share one query per request (same context object).
export const getProductBySlug = cache((ctx: PricingKey, slug: string) => productBySlug(pricingKey(ctx), slug));

async function productBySlug(key: PricingKey, slug: string): Promise<ProductProjection | undefined> {
  "use cache: remote";
  cacheFor("prices", TAGS.catalog);
  // Slugs come from the URL: allow only the characters product slugs use, so the predicate can't be broken.
  if (!/^[A-Za-z0-9._-]+$/.test(slug)) return undefined;
  const { body } = await apiRoot
    .productProjections()
    .get({ queryArgs: { where: `slug(${LOCALE}="${slug}")`, limit: 1, ...priceSelection(key) } })
    .execute();
  return body.results[0];
}

// The product as every visitor sees it (name, pictures, description, variants), without a price: the product page's
// prerendered shell. Shared by everyone; prices and stock come from getProductBySlug for the visitor.
export async function getProductContent(slug: string): Promise<ProductProjection | undefined> {
  "use cache: remote";
  cacheFor("prices", TAGS.catalog);
  if (!/^[A-Za-z0-9._-]+$/.test(slug)) return undefined;
  const { body } = await apiRoot
    .productProjections()
    .get({ queryArgs: { where: `slug(${LOCALE}="${slug}")`, limit: 1 } })
    .execute();
  return body.results[0];
}

// For CMS "products" blocks: SKUs come from content files, so only allow SKU characters in the predicate.
export function getProductsBySkus(ctx: PricingKey, skus: unknown): Promise<ProductProjection[]> {
  if (!Array.isArray(skus)) return Promise.resolve([]);
  const safe = skus.filter((s): s is string => typeof s === "string" && /^[A-Za-z0-9._-]+$/.test(s)).slice(0, 100);
  return safe.length === 0 ? Promise.resolve([]) : productsBySkus(pricingKey(ctx), safe);
}

async function productsBySkus(key: PricingKey, safe: string[]): Promise<ProductProjection[]> {
  "use cache: remote";
  cacheFor("prices", TAGS.catalog);
  const list = safe.map((s) => `"${s}"`).join(", ");
  const { body } = await apiRoot
    .productProjections()
    .get({
      queryArgs: {
        where: `masterVariant(sku in (${list})) or variants(sku in (${list}))`,
        limit: safe.length,
        ...priceSelection(key),
      },
    })
    .execute();
  // Keep the editor's order.
  return safe
    .map((sku) => body.results.find((p) => allVariants(p).some((v) => v.sku === sku)))
    .filter((p, i, arr): p is ProductProjection => !!p && arr.indexOf(p) === i);
}

export function getProductsByIds(ctx: PricingKey, ids: string[]): Promise<ProductProjection[]> {
  return ids.length === 0 ? Promise.resolve([]) : productsByIds(pricingKey(ctx), ids);
}

async function productsByIds(key: PricingKey, ids: string[]): Promise<ProductProjection[]> {
  "use cache: remote";
  cacheFor("prices", TAGS.catalog);
  const { body } = await apiRoot
    .productProjections()
    .get({ queryArgs: { where: `id in (${idList(ids)})`, limit: ids.length, ...priceSelection(key) } })
    .execute();
  // Keep the order of the references.
  return ids.map((id) => body.results.find((p) => p.id === id)).filter((p): p is ProductProjection => !!p);
}

// Homepage tiles: one picture + product count per category. They change rarely, so cache them per store
// (prices aren't involved) instead of running one query per category on every homepage load.
export type CategoryTile = { id: string; name: string; slug: string; total: number; image?: string };

export function getCategoryTiles(ctx: Pick<PricingKey, "storeKey">, categories: Category[], tree: CategoryTree): Promise<CategoryTile[]> {
  return categoryTiles(
    ctx.storeKey,
    categories.map((c) => ({ id: c.id, name: localize(c.name), slug: localize(c.slug), subtree: tree.subtreeIds(c.id) })),
  );
}

async function categoryTiles(storeKey: string, categories: { id: string; name: string; slug: string; subtree: string[] }[]) {
  "use cache: remote";
  cacheFor("structure", TAGS.catalog, TAGS.categories);
  return Promise.all(
    categories.map(async ({ id, name, slug, subtree }) => {
      const { body } = await apiRoot
        .productProjections()
        .get({ queryArgs: { where: `categories(id in (${idList(subtree)}))`, limit: 1, storeProjection: storeKey } })
        .execute();
      return { id, name, slug, total: body.total ?? body.count, image: body.results[0]?.masterVariant.images?.[0]?.url };
    }),
  );
}

// After catalog changes made elsewhere (Merchant Center, imports): the next search loads its index fresh. Per process,
// like the memo itself; the "use cache" reads are cleared by tag in /api/revalidate.
export function forgetCatalogCache() {
  searchMemo.clear();
}

// Site search. Product (Projection) Search is not activated in this project, so the header search uses a small
// in-memory index (refreshed every 5 minutes): names, SKUs and model codes, categories, attributes and descriptions,
// ranked in features/catalog/search.ts. Fine for a catalog this size. For a large catalog, activate the Product
// Search API in Merchant Center and set CATALOG_SEARCH=product-search (features/catalog/product-search.ts); if it
// fails (e.g. not activated yet), search falls back to the in-memory index.
const searchMemo = staleWhileRevalidate<SearchEntry[]>(TTL_MS);

// A product as a search hit: the master variant's price, or the lowest as "from" when variants differ. Products
// without a price in the context are left out, so a hit always has a card to show.
function toSearchEntry(p: ProductProjection, tree: CategoryTree): SearchEntry | undefined {
  const variants = allVariants(p);
  const prices = variants.flatMap((v) => (v.price ? [v.price.discounted?.value ?? v.price.value] : []));
  const priced = p.masterVariant.price ? p.masterVariant : variants.find((v) => v.price);
  if (!priced) return undefined;
  const categories = p.categories
    .map((ref) => tree.all.find((c) => c.id === ref.id))
    .flatMap((c) => (c ? [...tree.ancestors(c), c].map((x) => localize(x.name)) : []));
  return {
    id: p.id,
    name: localize(p.name),
    slug: localize(p.slug),
    sku: priced.sku,
    image: priced.images?.[0]?.url ?? p.masterVariant.images?.[0]?.url,
    price: priced.price?.discounted?.value ?? priced.price?.value,
    fromPrice:
      new Set(prices.map((m) => m.centAmount)).size > 1 ? prices.reduce((a, b) => (b.centAmount < a.centAmount ? b : a)) : undefined,
    nameWords: words(localize(p.name)),
    codes: [...new Set(variants.flatMap((v) => (v.sku ? codeWords(v.sku) : [])))],
    categories: [...new Set(categories.flatMap(words))],
    attributes: [...new Set(variants.flatMap((v) => specRows(v).flatMap((r) => words(r.value))))],
    description: [...new Set(words(localize(p.description)))],
  };
}

// One index per store (and customer group), built with the same price selection as the result cards: a product without a price in the
// store is left out, so the total always matches the cards shown.
const searchIndex = (key: PricingKey) =>
  searchMemo(pricingKeyId(key), async () => {
    const tree = await getCategoryTree();
    const entries: SearchEntry[] = [];
    for (let offset = 0; ; offset += 500) {
      const { body } = await apiRoot
        .productProjections()
        .get({ queryArgs: { limit: 500, offset, withTotal: false, ...priceSelection(key) } })
        .execute();
      for (const p of body.results) {
        const entry = toSearchEntry(p, tree);
        if (entry) entries.push(entry);
      }
      if (body.results.length < 500) break;
    }
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  });

const storeIds = staleWhileRevalidate<string>(TTL_MS);
const storeId = (key: string) =>
  storeIds(key, () =>
    apiRoot
      .stores()
      .withKey({ key })
      .get()
      .execute()
      .then((r) => r.body.id),
  );

// The Product Search API's hits in its own relevance order; undefined when it's off or failed (use the index then).
// After a failure it rests for 5 minutes, so an outage costs one logged error, not one per search.
const PRODUCT_SEARCH_RETRY_MS = 5 * 60 * 1000;
let productSearchFailedAt = 0;

async function productSearch(key: PricingKey, query: string, offset: number, limit: number) {
  if (!productSearchEnabled() || Date.now() - productSearchFailedAt < PRODUCT_SEARCH_RETRY_MS) return undefined;
  try {
    const [tree, id] = await Promise.all([getCategoryTree(), storeId(key.storeKey)]);
    const body = productSearchRequest(query, { ...key, storeId: id }, { offset, limit, locale: LOCALE });
    if (!body) return { entries: [], total: 0 };
    const { body: res } = await apiRoot.products().search().post({ body }).execute();
    const entries = res.results.flatMap((r) => (r.productProjection ? [toSearchEntry(r.productProjection, tree)] : []));
    return { entries: entries.filter((e): e is SearchEntry => !!e), total: res.total };
  } catch (err) {
    productSearchFailedAt = Date.now();
    console.error("Product Search failed, using the in-memory index for 5 minutes", (err as { body?: unknown })?.body ?? err);
    return undefined;
  }
}

export async function searchProducts(ctx: PricingKey, query: string, page: number, size: number) {
  const key = pricingKey(ctx);
  const found = await productSearch(key, query, (page - 1) * size, size);
  if (found)
    return {
      products: await getProductsByIds(
        key,
        found.entries.map((e) => e.id),
      ),
      total: found.total,
      corrected: undefined,
    };
  const { matches, corrected } = rank(await searchIndex(key), query);
  const products = await getProductsByIds(
    key,
    matches.slice((page - 1) * size, page * size).map((e) => e.id),
  );
  return { products, total: matches.length, corrected };
}

// Autocomplete: the best few products (from the index, so no extra API call) and matching categories.
export async function suggestProducts(ctx: PricingKey, query: string, limit = 6) {
  const key = pricingKey(ctx);
  const [found, tree] = await Promise.all([productSearch(key, query, 0, limit), getCategoryTree()]);
  const { matches, corrected } = found ? { matches: found.entries, corrected: undefined } : rank(await searchIndex(key), query);
  const qs = words(query);
  const categories = qs.length
    ? tree.all.filter((c) => {
        const name = words(localize(c.name));
        return qs.every((w) => name.some((t) => t.startsWith(w)));
      })
    : [];
  return { products: matches.slice(0, limit), total: found?.total ?? matches.length, corrected, categories: categories.slice(0, 3) };
}

// Every product a guest can open (the guest store's assortment, priced), page by page (sitemap): the product page
// uses the same store projection, so the sitemap never lists a URL that answers 404.
export function allProductSlugs(guest: PricingKey): Promise<{ slug: string; lastModified: string }[]> {
  return productSlugs(pricingKey(guest));
}

async function productSlugs(key: PricingKey): Promise<{ slug: string; lastModified: string }[]> {
  "use cache: remote";
  cacheFor("prices", TAGS.catalog);
  const out: { slug: string; lastModified: string }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { body } = await apiRoot
      .productProjections()
      .get({ queryArgs: { limit: 500, offset, withTotal: false, sort: ["id asc"], ...priceSelection(key) } })
      .execute();
    out.push(...body.results.map((p) => ({ slug: localize(p.slug), lastModified: p.lastModifiedAt })));
    if (body.results.length < 500) return out;
  }
}
