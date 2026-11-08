import { t } from "@/lib/i18n";
import { TrackEvent } from "@/features/analytics/components/DataLayer";
import { itemListEvent } from "@/features/analytics/events";
import { productItems } from "@/features/analytics/items";
import { Suspense } from "react";
import { fitsOptions } from "@/features/fitment/service";
import { productSearchEnabled } from "@/features/catalog/product-search";
import { notFound } from "next/navigation";
import type { Category } from "@commercetools/platform-sdk";
import { getAllProductsInCategories, getCategoryTree, searchCategoryListing, type CategoryTree } from "@/features/catalog/service";
import { requireBrowseContext } from "@/features/business-units/context";
import { CategoryListingSkeleton } from "@/components/ui/Skeletons";
import { categoryHref, localize, taxNote } from "@/features/catalog/utils";
import {
  catalogHref,
  FILTER_KEYS,
  layer,
  LIMITS,
  parseFilters,
  parseLimit,
  parseSort,
  parseView,
  SORTS,
  type CategoryOption,
  type Filters,
  type SortKey,
} from "@/features/catalog/layered";
import { Pagination } from "@/components/ui/Pagination";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/ui/JsonLd";
import { breadcrumbJsonLd } from "@/features/catalog/seo";
import { siteUrl } from "@/lib/site-url";
import { urlKey } from "@/lib/urls";
import { ProductCard } from "@/features/catalog/components/ProductCard";
import { ProductTable } from "@/features/catalog/components/ProductTable";
import { CatalogNav, CatalogResults, NavLink, PriceSlider, ShopByPanel, SortToolbar } from "@/features/catalog/components/LayeredNav";
import { CmsBlocks } from "@/features/cms/components/CmsBlocks";

export type CategoryQuery = Record<string, string | string[] | undefined>;

// Category page (product list). The shell holds what is the same for every visitor: breadcrumbs, the heading and the
// breadcrumb JSON-LD; an unknown category answers a real 404 here. The products, filters and counts depend on the
// visitor's store and prices (and the URL's filters), so the listing streams in behind <Suspense>.
export async function CategoryView({ slug, query }: { slug: string; query: Promise<CategoryQuery> }) {
  const tree = await getCategoryTree();
  const category = tree.bySlug(slug);
  if (!category) notFound();
  const trail = [...tree.ancestors(category), category];

  return (
    <div className="flex flex-col gap-6">
      <JsonLd
        data={breadcrumbJsonLd(
          trail.map((c, i) => ({ name: localize(c.name), url: `${siteUrl()}${categoryHref(trail.slice(0, i + 1))}` })),
        )}
      />
      <Breadcrumbs
        items={[
          ...tree.ancestors(category).map((a, i, all) => ({ label: localize(a.name), href: categoryHref(all.slice(0, i + 1)) })),
          { label: localize(category.name) },
        ]}
      />
      <h1 className="m-0 text-2xl font-bold">{localize(category.name)}</h1>
      <Suspense fallback={<CategoryListingSkeleton />}>
        <CategoryListing category={category} tree={tree} query={query} />
      </Suspense>
    </div>
  );
}

// The CMS block on top, layered navigation on the left ("Shop By", "Now Shopping by"), the toolbar (sort, direction,
// page size) and the products on the right, for this visitor. All state is in the URL (layered.ts).
async function CategoryListing({
  category,
  tree,
  query: queryPromise,
}: {
  category: Category;
  tree: CategoryTree;
  query: Promise<CategoryQuery>;
}) {
  const [query, { context }] = await Promise.all([queryPromise, requireBrowseContext()]);
  const filters = parseFilters(query);
  const sort = parseSort(query.sort);
  const limit = parseLimit(query.limit);
  const view = parseView(query.view);
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);

  const categories: CategoryOption[] = tree.children(category.id).map((c) => ({
    // The URL key (hyphens), like every other catalog URL: raw slugs have underscores, which ?cat= doesn't accept.
    slug: urlKey(localize(c.slug)),
    name: localize(c.name),
    ids: new Set(tree.subtreeIds(c.id)),
  }));
  // Large catalogs: one page from the Product Search API (CATALOG_SEARCH=product-search); otherwise, or when it fails,
  // every product of the category filtered in memory. Both give the same facets, filters and order. With search off,
  // the products load together with the fitment options, as before.
  const subtree = tree.subtreeIds(category.id);
  const [fits, preloaded] = await Promise.all([
    fitsOptions(context),
    productSearchEnabled() ? undefined : getAllProductsInCategories(context, subtree),
  ]);
  const searched = await searchCategoryListing(context, {
    categoryId: category.id,
    filters,
    sort,
    offset: (page - 1) * limit,
    limit,
    categories: tree.children(category.id).map((c) => ({ slug: urlKey(localize(c.slug)), name: localize(c.name), id: c.id })),
    machines: fits?.options.map((m) => ({ slug: m.slug, name: m.name, productIds: [...m.ids] })),
    shownMachines: fits?.shown,
  });
  const { shown, total, facets, applied, price } = searched ? { ...searched, shown: searched.products } : await inMemoryListing();
  async function inMemoryListing() {
    const products = preloaded ?? (await getAllProductsInCategories(context, subtree));
    const layered = layer(products, filters, sort, categories, fits);
    return { ...layered, total: layered.products.length, shown: layered.products.slice((page - 1) * limit, page * limit) };
  }

  const pages = Math.max(1, Math.ceil(total / limit));
  // A page past the end is not a page (no thin duplicates for search engines).
  if (page > pages) notFound();

  const state = { filters, sort, limit, page, view };
  const basePath = categoryHref([...tree.ancestors(category), category]);
  const href = (change: Parameters<typeof catalogHref>[2]) => catalogHref(basePath, state, change);
  const without = (key: string): Filters => Object.fromEntries(Object.entries(filters).filter(([k]) => k !== key));
  const trail = [...tree.ancestors(category), category];
  const note = taxNote(context.country);

  // Sort By: one entry per field (keeping the direction when it's the current field) and the arrow for the other one.
  const current = SORTS[sort];
  const fields = (["name", "price", "newest"] as const).map((field) => {
    const key = (field === current.field ? sort : field === "newest" ? "newest" : `${field}-asc`) as SortKey;
    return { value: key, label: SORTS[key].label, href: href({ sort: key }) };
  });
  const flipped = current.field === "newest" ? undefined : (`${current.field}-${current.dir === "asc" ? "desc" : "asc"}` as SortKey);

  const group = (key: string, title: string, body: React.ReactNode) => (
    <details key={key} open className="group py-3">
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden="true" className="text-gray-500 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="mt-2">{body}</div>
    </details>
  );
  const optionGroup = (f: (typeof facets)[number]) =>
    group(
      f.key,
      f.label,
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {f.options.map((o) => (
          <li key={o.value}>
            <NavLink
              href={href({ filters: { ...filters, [f.key]: o.value } })}
              className="flex min-h-9 items-center justify-between gap-2 rounded px-2 text-sm text-gray-800 no-underline hover:bg-white hover:text-orange-800"
            >
              <span>{o.label}</span>
              <span className="text-xs text-gray-600">({o.count})</span>
            </NavLink>
          </li>
        ))}
      </ul>,
    );
  // The plain (no JavaScript) forms keep the other filters, the sort and the page size.
  const formState = {
    ...Object.fromEntries(FILTER_KEYS.filter((k) => filters[k]).map((k) => [k, filters[k]!])),
    ...(sort !== "name-asc" && { sort }),
    ...(limit !== 24 && { limit: String(limit) }),
    ...(view === "table" && { view }),
  };

  return (
    <>
      <CmsBlocks placement="plp.top" context={context} categorySlugs={trail.map((c) => localize(c.slug))} />

      <CatalogNav>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <ShopByPanel applied={applied.length}>
            <div className="flex flex-col gap-5">
              <h2 className="m-0 hidden text-lg font-semibold lg:block">{t("plp.shopBy")}</h2>

              {applied.length > 0 && (
                <section aria-labelledby="now-shopping" className="flex flex-col gap-2">
                  <h3 id="now-shopping" className="m-0 text-sm font-semibold uppercase tracking-wide text-gray-600">
                    {t("plp.nowShopping")}
                  </h3>
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {applied.map((a) => (
                      <li key={a.key} className="flex items-center justify-between gap-2 rounded bg-white px-3 py-2 text-sm">
                        <span>
                          <span className="text-gray-600">{a.label}:</span> <span className="font-semibold">{a.valueLabel}</span>
                        </span>
                        <NavLink
                          href={href({ filters: without(a.key) })}
                          label={`Remove ${a.label} ${a.valueLabel}`}
                          className="flex h-8 w-8 items-center justify-center rounded text-lg text-gray-600 no-underline hover:bg-gray-100 hover:text-gray-900"
                        >
                          <span aria-hidden="true">×</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                  <NavLink href={href({ filters: {} })} className="self-start text-sm font-semibold text-orange-800">
                    {t("plp.clearAll")}
                  </NavLink>
                </section>
              )}

              {facets.length > 0 || price ? (
                <div className="flex flex-col divide-y divide-gray-200 border-y border-gray-200">
                  {facets.filter((f) => f.key === "fits" || f.key === "cat").map(optionGroup)}
                  {price &&
                    group(
                      "price",
                      t("plp.price"),
                      <PriceSlider
                        key={`${price.min}-${price.max}-${price.from}-${price.to}`}
                        {...price}
                        hrefFor={href({ filters: { ...filters, price: "PRICE" } })}
                        clearHref={href({ filters: without("price") })}
                        hidden={formState}
                      />,
                    )}
                  {facets.filter((f) => f.key !== "fits" && f.key !== "cat").map(optionGroup)}
                </div>
              ) : (
                applied.length === 0 && <p className="m-0 text-sm text-gray-600">No filters for these products.</p>
              )}
            </div>
          </ShopByPanel>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="m-0 text-sm text-gray-600">
                {total === 0
                  ? t("plp.noProducts")
                  : total <= limit
                    ? total === 1
                      ? t("plp.item")
                      : t("plp.items", { count: total })
                    : t("plp.range", { from: (page - 1) * limit + 1, to: Math.min(page * limit, total), total })}
              </p>
              <SortToolbar
                key={`${sort}-${limit}`}
                fields={fields}
                field={sort}
                direction={flipped && { dir: current.dir, href: href({ sort: flipped }) }}
                limits={LIMITS.map((n) => ({ value: String(n), label: String(n), href: href({ limit: n }) }))}
                limit={String(limit)}
                hidden={{
                  ...Object.fromEntries(FILTER_KEYS.filter((k) => filters[k]).map((k) => [k, filters[k]!])),
                  ...(view === "table" && { view }),
                }}
              />
              <nav aria-label="View as" className="flex overflow-hidden rounded border border-gray-300 text-sm">
                {(["grid", "table"] as const).map((v) => (
                  <NavLink
                    key={v}
                    href={href({ view: v })}
                    current={view === v}
                    className={`flex min-h-9 items-center px-3 no-underline ${
                      view === v ? "bg-gray-900 text-white" : "bg-white text-gray-800 hover:bg-gray-100"
                    }`}
                  >
                    <span className="sr-only">{t("plp.viewAs")} </span>
                    {v === "grid" ? t("plp.grid") : t("plp.table")}
                  </NavLink>
                ))}
              </nav>
            </div>

            {shown.length > 0 && (
              <TrackEvent
                event={itemListEvent(
                  urlKey(localize(category.slug)),
                  localize(category.name),
                  productItems(shown, localize(category.name)),
                  (page - 1) * limit,
                )}
              />
            )}
            <CatalogResults>
              {shown.length === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-md border border-gray-200 bg-white p-6">
                  <p className="m-0 text-gray-700">
                    {applied.length > 0
                      ? "We can't find products matching the selection."
                      : `No products in this category for ${context.storeName}.`}
                  </p>
                  {applied.length > 0 && (
                    <NavLink href={href({ filters: {} })} className="font-semibold text-orange-800">
                      Clear all filters
                    </NavLink>
                  )}
                </div>
              ) : view === "table" ? (
                <ProductTable products={shown} canOrder={context.canOrder} canQuote={!context.consumer} note={note} />
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                  {shown.map((p) => (
                    <ProductCard key={p.id} product={p} canOrder={context.canOrder} canQuote={!context.consumer} note={note} />
                  ))}
                </div>
              )}
            </CatalogResults>

            <Pagination page={page} pages={pages} hrefFor={(p) => href({ page: p })} label="Product pages" />
          </div>
        </div>
      </CatalogNav>
    </>
  );
}
