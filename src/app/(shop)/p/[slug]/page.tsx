import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBrowseContext } from "@/features/business-units/context";
import { getProductBySlug } from "@/features/catalog/service";
import { productMetadata } from "@/features/catalog/seo";
import { ProductView } from "@/features/catalog/components/ProductView";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

// Per-visitor product page (signed-in customers, ?sku= links). Guests without query parameters get the cached copy
// in (cached)/g (see src/middleware.ts). Metadata resolves before the page renders, so unknown slugs answer a real 404.
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const [{ slug }, { context }] = await Promise.all([params, requireBrowseContext()]);
  const product = await getProductBySlug(context, slug);
  if (!product) notFound();
  return productMetadata(product);
}

export default async function ProductPage({ params, searchParams }: Params & { searchParams: Promise<{ sku?: string }> }) {
  const [{ slug }, { sku }, { context }] = await Promise.all([params, searchParams, requireBrowseContext()]);
  return <ProductView context={context} slug={slug} sku={sku} />;
}
