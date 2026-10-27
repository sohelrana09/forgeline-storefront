import { notFound } from "next/navigation";
import { getAllProductsInCategories, getCategoryTree } from "@/features/catalog/service";
import { categoryHref, localize, taxNote } from "@/features/catalog/utils";
import {
  catalogHref,
  FILTER_KEYS,
  layer,
  LIMITS,
  parseFilters,
  parseLimit,
  parseSort,
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
import { ProductCard } from "@/features/catalog/components/ProductCard";
import { CatalogNav, CatalogResults, NavLink, PriceSlider, ShopByPanel, SortToolbar } from "@/features/catalog/components/LayeredNav";
import { CmsBlocks } from "@/features/cms/components/CmsBlocks";
import type { BuyerContext } from "@/features/business-units/types";

export type CategoryQuery = Record<string, string | string[] | undefined>;

// Category page (product list): layered navigation on the left ("Shop By", "Now Shopping by"), the
// toolbar (sort, direction, page size) and the products on the right. All state is in the URL (layered.ts).
export async function CategoryView({ context, slug, query }: { context: BuyerContext; slug: string; query: CategoryQuery }) {
  const tree = await getCategoryTree();
  const category = tree.bySlug(slug);
  if (!category) notFound();

  const filters = parseFilters(query);
  const sort = parseSort(query.sort);
  const limit = parseLimit(query.limit);
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);

  const categories: CategoryOption[] = tree.children(category.id).map((c) => ({
    slug: localize(c.slug),
    name: localize(c.name),
    ids: new Set(tree.subtreeIds(c.id)),
  }));
  const products = await getAllProductsInCategories(context, tree.subtreeIds(category.id));
  const { products: listed, facets, applied, price } = layer(products, filters, sort, categories);

  const total = listed.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  // A page past the end is not a page (no thin duplicates for search engines).
  if (page > pages) notFound();
  const shown = listed.slice((page - 1) * limit, page * limit);

  const state = { filters, sort, limit, page };
  const basePath = categoryHref([...tree.ancestors(category), category]);
  const href = (change: Parameters<typeof catalogHref>[2]) => catalogHref(basePath, state, change);
  const without = (key: string): Filters => Object.fromEntries(Object.entries(filters).filter(([k]) => k !== key));
  const trail = [...tree.ancestors(category), category];

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
              <span className="text-xs text-gray-500">({o.count})</span>
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
  };

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

      <CmsBlocks placement="plp.top" context={context} categorySlugs={trail.map((c) => localize(c.slug))} />

      <CatalogNav>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <ShopByPanel applied={applied.length}>
            <div className="flex flex-col gap-5">
              <h2 className="m-0 hidden text-lg font-semibold lg:block">Shop By</h2>

              {applied.length > 0 && (
                <section aria-labelledby="now-shopping" className="flex flex-col gap-2">
                  <h3 id="now-shopping" className="m-0 text-sm font-semibold uppercase tracking-wide text-gray-600">
                    Now Shopping by
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
                    Clear All
                  </NavLink>
                </section>
              )}

              {facets.length > 0 || price ? (
                <div className="flex flex-col divide-y divide-gray-200 border-y border-gray-200">
                  {facets.filter((f) => f.key === "cat").map(optionGroup)}
                  {price &&
                    group(
                      "price",
                      "Price",
                      <PriceSlider
                        key={`${price.min}-${price.max}-${price.from}-${price.to}`}
                        {...price}
                        hrefFor={href({ filters: { ...filters, price: "PRICE" } })}
                        clearHref={href({ filters: without("price") })}
                        hidden={formState}
                      />,
                    )}
                  {facets.filter((f) => f.key !== "cat").map(optionGroup)}
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
                  ? "No products"
                  : total <= limit
                    ? `${total} ${total === 1 ? "item" : "items"}`
                    : `Items ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`}
              </p>
              <SortToolbar
                key={`${sort}-${limit}`}
                fields={fields}
                field={sort}
                direction={flipped && { dir: current.dir, href: href({ sort: flipped }) }}
                limits={LIMITS.map((n) => ({ value: String(n), label: String(n), href: href({ limit: n }) }))}
                limit={String(limit)}
                hidden={Object.fromEntries(FILTER_KEYS.filter((k) => filters[k]).map((k) => [k, filters[k]!]))}
              />
            </div>

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
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                  {shown.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      canOrder={context.canOrder}
                      canQuote={!context.consumer}
                      note={taxNote(context.country)}
                    />
                  ))}
                </div>
              )}
            </CatalogResults>

            <Pagination page={page} pages={pages} hrefFor={(p) => href({ page: p })} label="Product pages" />
          </div>
        </div>
      </CatalogNav>
    </div>
  );
}
