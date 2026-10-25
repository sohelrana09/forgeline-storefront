import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGuestContext } from "@/features/business-units/service";
import { allProductSlugs, getProductBySlug } from "@/features/catalog/service";
import { productMetadata } from "@/features/catalog/seo";
import { ProductView } from "@/features/catalog/components/ProductView";

// Cached guest product page, master variant (?sku= links use the per-visitor route).
export const revalidate = 300;
export const dynamic = "error";
// Prerendered at build (see c/[slug]/page.tsx for why on-demand ISR doesn't work behind the rewrite).
export async function generateStaticParams() {
  return (await allProductSlugs(await getGuestContext())).map((p) => ({ slug: p.slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const product = await getProductBySlug(await getGuestContext(), (await params).slug);
  if (!product) notFound();
  return productMetadata(product);
}

export default async function CachedProductPage({ params }: Params) {
  const [{ slug }, context] = await Promise.all([params, getGuestContext()]);
  return <ProductView context={context} slug={slug} />;
}
