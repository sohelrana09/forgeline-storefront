import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBrowseContext } from "@/features/business-units/context";
import { blogEnabled, getBlogCategory } from "@/features/blog/service";
import { listPath, pageNumber } from "@/features/blog/utils";
import { BlogListView } from "@/features/blog/components/BlogListView";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

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

export default function BlogCategoryPage(props: Props) {
  // Metadata streams in parallel with the page, so its notFound() alone doesn't stop the render.
  if (!blogEnabled()) notFound();
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BlogCategory {...props} />
    </Suspense>
  );
}

async function BlogCategory({ params, searchParams }: Props) {
  const [{ slug }, { page }] = await Promise.all([params, searchParams, requireBrowseContext()]);
  const category = await getBlogCategory(slug);
  if (!category) notFound();
  return <BlogListView filter={{ category: slug }} page={pageNumber(page)} category={category} />;
}
