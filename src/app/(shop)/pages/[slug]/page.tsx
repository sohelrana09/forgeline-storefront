import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBrowseContext } from "@/features/business-units/context";
import { getPage } from "@/features/cms/service";
import { CmsPageView } from "@/features/cms/components/CmsPageView";

export const dynamic = "force-dynamic";

// An unknown or inactive page answers a real 404 from the metadata step (see the product page).
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = await getPage((await params).slug).catch(() => undefined);
  if (!page) notFound();
  return { title: page.title, description: page.metaDescription, alternates: { canonical: `/pages/${page.slug}` } };
}

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }] = await Promise.all([params, requireBrowseContext()]);
  return <CmsPageView slug={slug} />;
}
