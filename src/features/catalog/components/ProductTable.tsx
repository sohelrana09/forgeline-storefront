import Image from "next/image";
import Link from "next/link";
import type { ProductProjection } from "@commercetools/platform-sdk";
import { isQuoteOnly, localize, productHref, specRows } from "@/features/catalog/utils";
import { lowestUnitPrice, priceSteps } from "@/features/catalog/tiers";
import { formatMoney } from "@/lib/utils";
import { PriceTag } from "@/features/catalog/components/PriceTag";
import { AddToCartForm } from "@/features/cart/components/AddToCartForm";

// The category listing as dense rows (?view=table): picture, name and SKU, key specifications, price and
// quantity + add to cart, for buyers who order by part number. Same products, filters, sort and pages as the grid.
export function ProductTable({
  products,
  canOrder,
  canQuote,
  note,
}: {
  products: ProductProjection[];
  canOrder: boolean;
  canQuote: boolean;
  note: string;
}) {
  // Parts have no attributes in the sample data: the column only shows when something on the page has specifications.
  const withSpecs = products.some((p) => specRows(p.masterVariant).length > 0);
  return (
    <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
      <table className={`w-full border-collapse text-sm ${withSpecs ? "min-w-[720px]" : "min-w-[560px]"}`}>
        <caption className="sr-only">Products</caption>
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-600">
            <th scope="col" className="w-16 p-3">
              <span className="sr-only">Picture</span>
            </th>
            <th scope="col" className="p-3">
              Product
            </th>
            {withSpecs && (
              <th scope="col" className="p-3">
                Specifications
              </th>
            )}
            <th scope="col" className="p-3">
              Price
            </th>
            <th scope="col" className="p-3">
              <span className="sr-only">Add to cart</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const variant = product.masterVariant;
            const name = localize(product.name);
            const href = productHref(product.slug);
            const image = variant.images?.[0];
            const specs = specRows(variant).slice(0, 3);
            return (
              <tr key={product.id} className="border-t border-gray-200 align-middle">
                <td className="p-3">
                  {image ? (
                    <Image
                      src={image.url}
                      alt=""
                      width={48}
                      height={48}
                      sizes="48px"
                      className="size-12 rounded bg-gray-50 object-contain"
                    />
                  ) : (
                    <div aria-hidden="true" className="size-12 rounded bg-gray-100" />
                  )}
                </td>
                <th scope="row" className="p-3 text-left font-normal">
                  <Link href={href} prefetch={false} className="font-semibold text-gray-900 no-underline hover:text-orange-800">
                    {name}
                  </Link>
                  <span className="block font-mono text-xs text-gray-600">{variant.sku}</span>
                </th>
                {withSpecs && (
                  <td className="p-3 text-gray-700">
                    {specs.length ? specs.map((s) => `${s.name}: ${s.value}`).join(" · ") : <span className="text-gray-400">-</span>}
                  </td>
                )}
                <td className="p-3">
                  <PriceTag price={variant.price} note={note} />
                  {variant.price && priceSteps(variant.price).length > 1 && !variant.price.discounted && (
                    <span className="block text-xs text-green-800">As low as {formatMoney(lowestUnitPrice(variant.price))}</span>
                  )}
                </td>
                <td className="p-3">
                  {variant.sku && (
                    <AddToCartForm
                      sku={variant.sku}
                      name={name}
                      canOrder={canOrder}
                      canQuote={canQuote}
                      quoteOnly={isQuoteOnly(variant.price)}
                      size="row"
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
