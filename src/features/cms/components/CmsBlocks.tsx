import { Suspense } from "react";
import Link from "next/link";
import { getBlocks } from "@/features/cms/service";
import { safeHref } from "@/features/cms/utils";
import type { CmsBlock, Placement } from "@/features/cms/types";
import { getProductsBySkus } from "@/features/catalog/service";
import type { BuyerContext } from "@/features/business-units/types";
import { taxNote } from "@/features/catalog/utils";
import { RichText } from "@/features/cms/components/RichText";
import { Carousel } from "@/components/ui/Carousel";
import { ProductCard } from "@/features/catalog/components/ProductCard";

const STYLES: Record<NonNullable<CmsBlock["style"]>, string> = {
  plain: "border border-gray-200 bg-white text-gray-800",
  info: "border border-blue-200 bg-blue-50 text-blue-950",
  promo: "border border-orange-300 bg-orange-50 text-orange-950",
};

type Props = {
  placement: Placement;
  context: BuyerContext;
  categorySlugs?: string[];
  className?: string;
};

// Streams in after the page's own content (Suspense), so CMS and its product queries never delay the page.
export function CmsBlocks(props: Props) {
  return (
    <Suspense fallback={null}>
      <CmsBlocksContent {...props} />
    </Suspense>
  );
}

// Renders every active block for a placement, filtered by store and (optionally) category slugs.
// A broken CMS must never take the page down, so failures render nothing and are logged.
async function CmsBlocksContent({ placement, context, categorySlugs, className = "" }: Props) {
  const blocks = await getBlocks({ placement, storeKey: context.storeKey, categorySlugs }).catch((err) => {
    console.error(`CMS blocks for ${placement} failed`, err?.body ?? err);
    return [];
  });
  if (blocks.length === 0) return null;
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {blocks.map((block) =>
        block.type === "products" ? (
          <ProductsBlock key={block.identifier} block={block} context={context} />
        ) : (
          <section
            key={block.identifier}
            aria-label={block.title}
            data-cms-block={block.identifier}
            className={`rounded-md p-4 text-sm ${STYLES[block.style ?? "plain"]}`}
          >
            <RichText value={block.body} context={context} />
            {block.cta && safeHref(block.cta.href) && (
              <Link href={safeHref(block.cta.href)!} prefetch={false} className="mt-2 inline-block font-semibold text-orange-800">
                {block.cta.label}
              </Link>
            )}
          </section>
        ),
      )}
    </div>
  );
}

async function ProductsBlock({ block, context }: { block: CmsBlock; context: BuyerContext }) {
  const products = await getProductsBySkus(context, block.skus).catch((err) => {
    console.error(`CMS products block ${block.identifier} failed`, err?.body ?? err);
    return [];
  });
  if (products.length === 0) return null;
  const ctaHref = safeHref(block.cta?.href);
  return (
    <section aria-label={block.title} data-cms-block={block.identifier}>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        {block.title && <h2 className="m-0 text-xl font-semibold">{block.title}</h2>}
        {block.cta && ctaHref && (
          <Link href={ctaHref} prefetch={false} className="text-sm text-orange-800">
            {block.cta.label}
          </Link>
        )}
      </div>
      <Carousel label={block.title ?? "Products"}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} canOrder={context.canOrder} canQuote={!context.consumer} note={taxNote(context.country)} />
        ))}
      </Carousel>
    </section>
  );
}
