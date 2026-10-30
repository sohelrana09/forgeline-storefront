import "server-only";
import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getCategoryTree, getProductBySlug } from "@/features/catalog/service";
import { categoryMetadata, productMetadata } from "@/features/catalog/seo";
import { CategoryView, type CategoryQuery } from "@/features/catalog/components/CategoryView";
import { getPage } from "@/features/cms/service";
import { CmsPageView } from "@/features/cms/components/CmsPageView";
import { resolveUrl } from "@/features/urls/service";
import { pagePath } from "@/lib/urls";
import { isDraftMode } from "@/lib/sanity/client";
import { stegaClean } from "next-sanity";
import { firstParam } from "@/lib/utils";
import type { BuyerContext } from "@/features/business-units/types";
import type { PricingKey } from "@/features/catalog/pricing";

// The catch-all catalog route: a path is a category, a product or a content page,
// a redirect (old URLs, other spellings, merchants' redirects) or a real 404. `resolveTarget` runs before anything
// streams, from the cached URL index, so unknown paths answer 404 and redirects are real redirects; the content
// (`CatalogContent`) depends on the visitor's prices and streams in behind <Suspense>.

const toQuery = (query: CategoryQuery) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) for (const v of [value].flat()) if (v !== undefined) params.append(key, v);
  return params;
};

// The URL's query is read only for redirects (they keep it) and the Studio's draft preview, so every other path
// renders without request data up to the content's <Suspense>.
export async function resolveTarget(path: string[], query: () => Promise<CategoryQuery>) {
  const target = await resolveUrl(path);
  if (target.kind === "redirect") {
    const kept = await resolveUrl(path, toQuery(await query()));
    if (kept.kind === "redirect") (kept.permanent ? permanentRedirect : redirect)(kept.to);
  }
  // In the Studio's preview, a page that isn't published yet has no URL in the index: show its draft.
  if (target.kind === "missing" && path.length === 1 && (await isDraftMode()) && (await getPage(path[0]))) {
    return { kind: "page" as const, slug: path[0] };
  }
  if (target.kind === "missing" || target.kind === "redirect") notFound();
  return target;
}

export type CatalogTarget = Awaited<ReturnType<typeof resolveTarget>>;

// Metadata is the public view (guest prices and assortment), the same for every visitor.
export async function catalogMetadata(path: string[], query: CategoryQuery, context: PricingKey): Promise<Metadata> {
  const target = await resolveTarget(path, async () => query);
  if (target.kind === "category") {
    const tree = await getCategoryTree();
    const category = tree.bySlug(target.slug);
    if (!category) notFound();
    const metadata = categoryMetadata(
      [...tree.ancestors(category), category],
      Math.max(1, Math.floor(Number(firstParam(query.page))) || 1),
    );
    // Filtered and re-sorted lists are views of the category, not pages of their own: keep them out of search results.
    return Object.keys(query).some((k) => k !== "page") ? { ...metadata, robots: { index: false, follow: true } } : metadata;
  }
  if (target.kind === "product") {
    const product = await getProductBySlug(context, target.slug);
    if (!product) notFound();
    return productMetadata(product);
  }
  const page = await getPage(target.slug).catch(() => undefined);
  if (!page) notFound();
  return {
    title: stegaClean(page.metaTitle || page.title),
    description: stegaClean(page.metaDescription),
    alternates: { canonical: pagePath(stegaClean(page.slug)) },
  };
}

// Categories and content pages, streamed for the visitor. Products render their own shell (ProductView).
export function CatalogContent({
  target,
  query,
  context,
}: {
  target: Exclude<CatalogTarget, { kind: "product" }>;
  query: CategoryQuery;
  context: BuyerContext;
}) {
  if (target.kind === "category") return <CategoryView context={context} slug={target.slug} query={query} />;
  return <CmsPageView slug={target.slug} context={context} />;
}
