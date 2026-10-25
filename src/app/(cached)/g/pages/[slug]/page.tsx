import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage, getPages } from "@/features/cms/service";
import { CmsPageView } from "@/features/cms/components/CmsPageView";

// Cached content page (the same for everyone).
export const revalidate = 300;
export const dynamic = "error";
// Prerendered at build (see c/[slug]/page.tsx for why on-demand ISR doesn't work behind the rewrite).
export async function generateStaticParams() {
  return (await getPages().catch(() => [])).filter((p) => p.active).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = await getPage((await params).slug).catch(() => undefined);
  if (!page) notFound();
  return { title: page.title, description: page.metaDescription, alternates: { canonical: `/pages/${page.slug}` } };
}

export default async function CachedCmsPage({ params }: { params: Promise<{ slug: string }> }) {
  return <CmsPageView slug={(await params).slug} />;
}
