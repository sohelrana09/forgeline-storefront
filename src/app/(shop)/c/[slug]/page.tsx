import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBrowseContext } from "@/features/business-units/context";
import { getCategoryTree } from "@/features/catalog/service";
import { categoryMetadata } from "@/features/catalog/seo";
import { CategoryView } from "@/features/catalog/components/CategoryView";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string; page?: string }> };

// Per-visitor category page (signed-in customers, ?sort / ?page). Guests without query parameters get the cached
// copy in (cached)/g. An unknown category answers a real 404 from the metadata step.
export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const [{ slug }, { page }] = await Promise.all([params, searchParams]);
  const category = (await getCategoryTree()).bySlug(slug);
  if (!category) notFound();
  return categoryMetadata(category, Math.max(1, Math.floor(Number(page)) || 1));
}

export default async function CategoryPage({ params, searchParams }: Params) {
  const [{ slug }, query, { context }] = await Promise.all([params, searchParams, requireBrowseContext()]);
  return <CategoryView context={context} slug={slug} query={query} />;
}
