import "server-only";
import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getCategoryTree, getProductBySlug } from "@/features/catalog/service";
import { categoryMetadata, productMetadata } from "@/features/catalog/seo";
import { CategoryView, type CategoryQuery } from "@/features/catalog/components/CategoryView";
import { ProductView } from "@/features/catalog/components/ProductView";
import { getPage } from "@/features/cms/service";
import { CmsPageView } from "@/features/cms/components/CmsPageView";
import { resolveUrl } from "@/features/urls/service";
import { pagePath } from "@/lib/urls";
import { isDraftMode } from "@/lib/sanity/client";
import { stegaClean } from "next-sanity";
import { firstParam } from "@/lib/utils";
import type { BuyerContext } from "@/features/business-units/types";

// The catch-all catalog route: a path is a category, a product or a content page,
// a redirect (old URLs, other spellings, merchants' redirects) or a real 404. Shared by the per-visitor route in
// (shop) and the cached guest copies in (cached)/g.

const toQuery = (query: CategoryQuery) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) for (const v of [value].flat()) if (v !== undefined) params.append(key, v);
  return params;
};

async function resolve(path: string[], query: CategoryQuery) {
  const target = await resolveUrl(path, toQuery(query));
  // In the Studio's preview, a page that isn't published yet has no URL in the index: show its draft.
  if (target.kind === "missing" && path.length === 1 && (await isDraftMode()) && (await getPage(path[0]))) {
    return { kind: "page" as const, slug: path[0] };
  }
  if (target.kind === "redirect") (target.permanent ? permanentRedirect : redirect)(target.to);
  if (target.kind === "missing" || target.kind === "redirect") notFound();
  return target;
}

export async function catalogMetadata(path: string[], query: CategoryQuery, context: BuyerContext): Promise<Metadata> {
  const target = await resolve(path, query);
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

export async function CatalogRoute({ path, query, context }: { path: string[]; query: CategoryQuery; context: BuyerContext }) {
  const target = await resolve(path, query);
  if (target.kind === "category") return <CategoryView context={context} slug={target.slug} query={query} />;
  if (target.kind === "product") return <ProductView context={context} slug={target.slug} sku={firstParam(query.sku)} />;
  return <CmsPageView slug={target.slug} context={context} />;
}
