import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBrowseContext } from "@/features/business-units/context";
import { blogEnabled } from "@/features/blog/service";
import { isUrlKey, listPath, pageNumber } from "@/features/blog/utils";
import { BlogListView } from "@/features/blog/components/BlogListView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tag: string }>; searchParams: Promise<{ page?: string }> };

// Tag lists are thin pages that repeat the category lists: followed, not indexed.
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  if (!blogEnabled()) notFound();
  const [{ tag }, { page }] = await Promise.all([params, searchParams]);
  if (!isUrlKey(tag)) notFound();
  return {
    title: `Posts tagged “${tag}”`,
    robots: { index: false, follow: true },
    alternates: { canonical: listPath({ tag }, pageNumber(page)) },
  };
}

export default async function BlogTagPage({ params, searchParams }: Props) {
  // Metadata streams in parallel with the page, so its notFound() alone doesn't stop the render.
  if (!blogEnabled()) notFound();
  const [{ tag }, { page }] = await Promise.all([params, searchParams, requireBrowseContext()]);
  return <BlogListView filter={{ tag }} page={pageNumber(page)} />;
}
