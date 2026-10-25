import Image from "next/image";
import Link from "next/link";
import type { ProductProjection } from "@commercetools/platform-sdk";
import { isQuoteOnly, localize } from "@/features/catalog/utils";
import { PriceTag } from "@/features/catalog/components/PriceTag";
import { AddToCartForm } from "@/features/cart/components/AddToCartForm";

export function ProductCard({
  product,
  canOrder,
  canQuote = true,
  note,
}: {
  product: ProductProjection;
  canOrder: boolean;
  canQuote?: boolean;
  note: string;
}) {
  const variant = product.masterVariant;
  const name = localize(product.name);
  const image = variant.images?.[0];
  const href = `/p/${localize(product.slug)}`;
  return (
    <article className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
      <Link href={href} className="block">
        {image ? (
          <Image
            src={image.url}
            alt=""
            width={400}
            height={400}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="aspect-square w-full rounded bg-gray-50 object-contain"
          />
        ) : (
          <div aria-hidden="true" className="aspect-square w-full rounded bg-gray-100" />
        )}
      </Link>
      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-sm font-semibold">
          <Link href={href} className="text-gray-900 no-underline hover:text-orange-800">
            {name}
          </Link>
        </h3>
        <span className="font-mono text-xs text-gray-600">{variant.sku}</span>
      </div>
      <div className="mt-auto flex flex-col gap-3">
        <PriceTag price={variant.price} note={note} />
        {variant.sku && (
          <AddToCartForm sku={variant.sku} name={name} canOrder={canOrder} canQuote={canQuote} quoteOnly={isQuoteOnly(variant.price)} />
        )}
      </div>
    </article>
  );
}
