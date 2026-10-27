import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBrowseContext } from "@/features/business-units/context";
import { blogEnabled } from "@/features/blog/service";
import { BLOG_PATH, listPath, pageNumber } from "@/features/blog/utils";
import { BlogListView } from "@/features/blog/components/BlogListView";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  if (!blogEnabled()) notFound();
  const page = pageNumber((await searchParams).page);
  return {
    title: page > 1 ? `Blog, page ${page}` : "Blog",
    description: "News, buying guides and maintenance tips for heavy machines and spare parts.",
    alternates: { canonical: listPath({}, page), types: { "application/rss+xml": `${BLOG_PATH}/rss.xml` } },
  };
}

export default async function BlogPage({ searchParams }: Props) {
  // Metadata streams in parallel with the page, so its notFound() alone doesn't stop the render.
  if (!blogEnabled()) notFound();
  const [{ page }] = await Promise.all([searchParams, requireBrowseContext()]);
  return <BlogListView filter={{}} page={pageNumber(page)} />;
}
