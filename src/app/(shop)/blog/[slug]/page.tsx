import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBrowseContext } from "@/features/business-units/context";
import { blogEnabled, getPost } from "@/features/blog/service";
import { postMetadata } from "@/features/blog/seo";
import { BlogPostView } from "@/features/blog/components/BlogPostView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!blogEnabled()) notFound();
  const post = await getPost((await params).slug);
  if (!post) notFound();
  return postMetadata(post);
}

export default async function BlogPostPage({ params }: Props) {
  // Metadata streams in parallel with the page, so its notFound() alone doesn't stop the render.
  if (!blogEnabled()) notFound();
  const [{ slug }, { context }] = await Promise.all([params, requireBrowseContext()]);
  return <BlogPostView slug={slug} context={context} />;
}
