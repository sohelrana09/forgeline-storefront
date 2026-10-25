import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGuestContext } from "@/features/business-units/service";
import { getCategoryTree } from "@/features/catalog/service";
import { localize } from "@/features/catalog/utils";
import { categoryMetadata } from "@/features/catalog/seo";
import { CategoryView } from "@/features/catalog/components/CategoryView";

// Cached guest category page, first page in the default order (?sort / ?page use the per-visitor route).
export const revalidate = 300;
export const dynamic = "error";
// Every slug must be listed at build time: Next 15.5 matches on-demand ISR against the URL before the middleware
// rewrite (/c/x, not /g/c/x), so a slug missing here renders per request (uncached) until the next build.
export async function generateStaticParams() {
  return (await getCategoryTree()).all.map((c) => ({ slug: localize(c.slug) }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const category = (await getCategoryTree()).bySlug((await params).slug);
  if (!category) notFound();
  return categoryMetadata(category);
}

export default async function CachedCategoryPage({ params }: Params) {
  const [{ slug }, context] = await Promise.all([params, getGuestContext()]);
  return <CategoryView context={context} slug={slug} query={{}} />;
}
