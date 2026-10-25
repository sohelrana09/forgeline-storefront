import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryTree, getProductsInCategories } from "@/features/catalog/service";
import { localize, LOCALE } from "@/features/catalog/utils";
import { taxNote } from "@/features/catalog/utils";
import { Pagination } from "@/components/ui/Pagination";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/ui/JsonLd";
import { breadcrumbJsonLd } from "@/features/catalog/seo";
import { siteUrl } from "@/lib/site-url";
import { ProductCard } from "@/features/catalog/components/ProductCard";
import { CmsBlocks } from "@/features/cms/components/CmsBlocks";
import type { BuyerContext } from "@/features/business-units/types";

const PAGE_SIZE = 24;
const SORTS: Record<string, { label: string; sort: string }> = {
  "name-asc": { label: "Name A–Z", sort: `name.${LOCALE} asc` },
  "name-desc": { label: "Name Z–A", sort: `name.${LOCALE} desc` },
  newest: { label: "Newest", sort: "createdAt desc" },
};

export async function CategoryView({ context, slug, query }: { context: BuyerContext; slug: string; query: { sort?: string; page?: string } }) {
  const tree = await getCategoryTree();
  const category = tree.bySlug(slug);
  if (!category) notFound();

  const sortKey = query.sort && SORTS[query.sort] ? query.sort : "name-asc";
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const result = await getProductsInCategories(context, tree.subtreeIds(category.id), {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    sort: SORTS[sortKey].sort,
  });
  const total = result.total ?? result.count;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // A page past the end is not a page (no thin duplicates for search engines).
  if (page > pages) notFound();
  const children = tree.children(category.id);
  const pageHref = (p: number) => `/c/${slug}?sort=${sortKey}&page=${p}`;

  const trail = [...tree.ancestors(category), category];

  return (
    <div className="flex flex-col gap-6">
      <JsonLd data={breadcrumbJsonLd(trail.map((c) => ({ name: localize(c.name), url: `${siteUrl()}/c/${localize(c.slug)}` })))} />
      <Breadcrumbs
        items={[
          ...tree.ancestors(category).map((a) => ({ label: localize(a.name), href: `/c/${localize(a.slug)}` })),
          { label: localize(category.name) },
        ]}
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-bold">{localize(category.name)}</h1>
          <p className="m-0 mt-1 text-sm text-gray-600">
            {total} {total === 1 ? "product" : "products"}
          </p>
        </div>
        <form className="flex items-end gap-2 text-sm">
          <label className="flex flex-col gap-1">
            Sort by
            <select name="sort" defaultValue={sortKey} className="min-h-11 rounded border border-gray-300 bg-white px-2">
              {Object.entries(SORTS).map(([key, s]) => (
                <option key={key} value={key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button className="min-h-11 rounded bg-gray-900 px-4 font-semibold text-white">Apply</button>
        </form>
      </div>

      <CmsBlocks
        placement="plp.top"
        context={context}
        categorySlugs={[...tree.ancestors(category), category].map((c) => localize(c.slug))}
      />

      {children.length > 0 && (
        <nav aria-label="Subcategories">
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {children.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/c/${localize(c.slug)}`}
                  className="block rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 no-underline hover:border-orange-700"
                >
                  {localize(c.name)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {result.results.length === 0 ? (
        <p className="text-gray-600">No products in this category for {context.storeName}.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {result.results.map((p) => (
            <ProductCard key={p.id} product={p} canOrder={context.canOrder} canQuote={!context.consumer} note={taxNote(context.country)} />
          ))}
        </div>
      )}

      <Pagination page={page} pages={pages} hrefFor={pageHref} label="Product pages" />
    </div>
  );
}
