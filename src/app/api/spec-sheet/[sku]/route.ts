import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site-url";
import { getProductContentBySku } from "@/features/catalog/service";
import { allVariants, localize, productHref, specRows } from "@/features/catalog/utils";
import { renderSpecSheet } from "@/features/compare/spec-sheet";

// GET /api/spec-sheet/<sku>: the variant's spec sheet as a PDF. No price and nothing about the visitor, so it is
// cached publicly for an hour.
export async function GET(_request: Request, { params }: { params: Promise<{ sku: string }> }) {
  const sku = decodeURIComponent((await params).sku).replace(/\.pdf$/i, "");
  const product = await getProductContentBySku(sku);
  const variant = product && allVariants(product).find((v) => v.sku === sku);
  if (!product || !variant) return new NextResponse("Not found", { status: 404 });
  const slug = localize(product.slug);
  const pdf = await renderSpecSheet({
    name: localize(product.name),
    sku,
    specs: specRows(variant),
    description: localize(product.description),
    url: `${siteUrl()}${productHref(slug, sku)}`,
  });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${sku}-spec-sheet.pdf"`,
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
