import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBrowseContext } from "@/features/business-units/context";
import { blogEnabled, getBlogCategory } from "@/features/blog/service";
import { listPath, pageNumber } from "@/features/blog/utils";
import { BlogListView } from "@/features/blog/components/BlogListView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  if (!blogEnabled()) notFound();
  const [{ slug }, { page }] = await Promise.all([params, searchParams]);
  const category = await getBlogCategory(slug);
  if (!category) notFound();
  const n = pageNumber(page);
  return {
    title: n > 1 ? `${category.title}, page ${n}` : category.title,
    description: category.description,
    alternates: { canonical: listPath({ category: slug }, n) },
  };
}

export default async function BlogCategoryPage({ params, searchParams }: Props) {
  // Metadata streams in parallel with the page, so its notFound() alone doesn't stop the render.
  if (!blogEnabled()) notFound();
  const [{ slug }, { page }] = await Promise.all([params, searchParams, requireBrowseContext()]);
  const category = await getBlogCategory(slug);
  if (!category) notFound();
  return <BlogListView filter={{ category: slug }} page={pageNumber(page)} category={category} />;
}
