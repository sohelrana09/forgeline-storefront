import Image from "next/image";
import Link from "next/link";
import { PortableText, stegaClean, type PortableTextBlock, type PortableTextComponents } from "next-sanity";
import { safeHref } from "@/features/cms/utils";
import { getProductsBySkus } from "@/features/catalog/service";
import { taxNote } from "@/features/catalog/utils";
import { ProductCard } from "@/features/catalog/components/ProductCard";
import type { BuyerContext } from "@/features/business-units/types";
import { imageUrl, type SanityImage } from "@/lib/sanity/image";

// Sanity rich text (Portable Text) → React, styled like the Markdown pages. Portable Text is structured data, so
// there is no HTML to inject; links pass safeHref and pictures come only from this project's Sanity CDN folder.
// Product cards show live commercetools products at the visitor's own prices.

type ProductRef = { _key?: string; sku?: string };

export async function ProductCards({ title, products, context }: { title?: string; products?: ProductRef[]; context: BuyerContext }) {
  const skus = (products ?? []).map((p) => stegaClean(p.sku)).filter((s): s is string => !!s);
  if (skus.length === 0) return null;
  const found = await getProductsBySkus(context, skus).catch((err) => {
    console.error("Sanity product cards failed", err?.body ?? err);
    return [];
  });
  if (found.length === 0) return null;
  return (
    <section aria-label={title ?? "Products"} className="not-prose my-6">
      {title && <h2 className="mb-3 mt-0 text-xl font-semibold">{title}</h2>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {found.map((p) => (
          <ProductCard key={p.id} product={p} canOrder={context.canOrder} canQuote={!context.consumer} note={taxNote(context.country)} />
        ))}
      </div>
    </section>
  );
}

type TableRow = { _key?: string; cells?: { _key?: string; value?: PortableTextBlock[] }[] };

function Table({ headerRows = 1, rows = [] }: { headerRows?: number; rows?: TableRow[] }) {
  const cell = (c: { value?: PortableTextBlock[] }) => (
    <PortableText value={c.value ?? []} components={{ block: { normal: ({ children }) => <>{children}</> } }} />
  );
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {headerRows > 0 && (
          <thead>
            {rows.slice(0, headerRows).map((r, i) => (
              <tr key={r._key ?? i}>
                {r.cells?.map((c, j) => (
                  <th key={c._key ?? j} className="border-b border-gray-300 py-2 pr-4 text-left font-semibold">
                    {cell(c)}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
        )}
        <tbody>
          {rows.slice(headerRows).map((r, i) => (
            <tr key={r._key ?? i}>
              {r.cells?.map((c, j) => (
                <td key={c._key ?? j} className="border-b border-gray-100 py-2 pr-4">
                  {cell(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const components = (context?: BuyerContext): PortableTextComponents => ({
  block: {
    normal: ({ children }) => <p className="my-3 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
    h2: ({ children }) => <h2 className="mb-2 mt-6 text-xl font-semibold first:mt-0">{children}</h2>,
    h3: ({ children }) => <h3 className="mb-2 mt-5 text-lg font-semibold first:mt-0">{children}</h3>,
    h4: ({ children }) => <h4 className="mb-2 mt-4 font-semibold first:mt-0">{children}</h4>,
    blockquote: ({ children }) => (
      <blockquote className="my-4 border-l-4 border-orange-700 pl-4 italic text-gray-700">{children}</blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => <ul className="my-3 list-disc pl-5">{children}</ul>,
    number: ({ children }) => <ol className="my-3 list-decimal pl-5">{children}</ol>,
  },
  marks: {
    code: ({ children }) => <code className="rounded bg-gray-100 px-1 font-mono text-sm">{children}</code>,
    link: ({ value, children }) => {
      const href = safeHref(stegaClean(value?.href));
      if (!href) return <>{children}</>;
      return href.startsWith("/") ? (
        <Link href={href} className="text-orange-800 underline">
          {children}
        </Link>
      ) : (
        <a href={href} className="text-orange-800 underline" rel="noopener noreferrer" target="_blank">
          {children}
        </a>
      );
    },
  },
  types: {
    image: ({ value }: { value: SanityImage & { caption?: string } }) =>
      value?.asset ? (
        <figure className="my-5">
          <Image
            src={imageUrl(value, 1200, 675)}
            alt={stegaClean(value.alt) ?? ""}
            width={1200}
            height={675}
            sizes="(min-width: 768px) 720px, 100vw"
            className="h-auto w-full rounded"
          />
          {value.caption && <figcaption className="mt-2 text-sm text-gray-600">{value.caption}</figcaption>}
        </figure>
      ) : null,
    table: ({ value }: { value: { headerRows?: number; rows?: TableRow[] } }) => <Table {...value} />,
    productCards: ({ value }: { value: { title?: string; products?: ProductRef[] } }) =>
      context ? <ProductCards title={value.title} products={value.products} context={context} /> : null,
  },
});

export function RichText({ value, context }: { value?: PortableTextBlock[]; context?: BuyerContext }) {
  if (!value?.length) return null;
  return <PortableText value={value} components={components(context)} />;
}
