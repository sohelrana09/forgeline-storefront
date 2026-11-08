import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { formatMoney } from "@/lib/utils";
import type { BuyerContext } from "@/features/business-units/types";
import { getProductsBySkus } from "@/features/catalog/service";
import { allVariants, localize, productHref, specRows, taxNote } from "@/features/catalog/utils";
import { compareHref, compareRows } from "@/features/compare/compare";

// Products side by side: picture, price for this visitor, then every specification, with the rows that differ marked.
export async function CompareView({ context, skus }: { context: BuyerContext; skus: string[] }) {
  const products = await getProductsBySkus(context, skus);
  const columns = skus.flatMap((sku) => {
    const product = products.find((p) => allVariants(p).some((v) => v.sku === sku));
    const variant = product && allVariants(product).find((v) => v.sku === sku);
    return product && variant ? [{ sku, product, variant, specs: specRows(variant) }] : [];
  });
  const rows = compareRows(columns);
  const note = taxNote(context.country);
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Compare products" }]} />
      <h1 className="m-0 text-2xl font-bold">Compare products</h1>
      {columns.length < 2 ? (
        <p className="m-0">
          {columns.length === 0 ? "Nothing to compare yet." : "Add one more product to compare."} Tick &quot;Compare&quot; on up to four
          product pages.
        </p>
      ) : null}
      {columns.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">Specifications of the compared products</caption>
            <thead>
              <tr className="align-top">
                <td className="w-40 p-4" />
                {columns.map(({ sku, product, variant }) => {
                  const price = variant.price && (variant.price.discounted?.value ?? variant.price.value);
                  const image = variant.images?.[0]?.url ?? product.masterVariant.images?.[0]?.url;
                  return (
                    <th key={sku} scope="col" className="p-4 text-left font-normal">
                      {image && (
                        <Image
                          src={image}
                          alt=""
                          width={160}
                          height={160}
                          sizes="160px"
                          className="mb-2 aspect-square w-32 object-contain"
                        />
                      )}
                      <Link href={productHref(product.slug, sku)} className="block font-semibold">
                        {localize(product.name)}
                      </Link>
                      <span className="block text-xs text-gray-600">SKU {sku}</span>
                      <span className="mt-1 block font-semibold">
                        {price ? `${formatMoney(price)} ` : "Price on request "}
                        {price && <span className="text-xs font-normal text-gray-600">{note}</span>}
                      </span>
                      <Link href={compareHref(skus.filter((s) => s !== sku))} className="mt-1 block text-xs text-red-700">
                        Remove
                      </Link>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className={`border-t border-gray-200 ${r.differs ? "bg-orange-50" : ""}`}>
                  <th scope="row" className="p-4 text-left font-medium text-gray-700">
                    {r.name}
                    {r.differs && <span className="sr-only"> (differs)</span>}
                  </th>
                  {r.values.map((v, i) => (
                    <td key={columns[i].sku} className="p-4">
                      {v || "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.some((r) => r.differs) && <p className="m-0 text-xs text-gray-600">Highlighted rows differ between the products.</p>}
    </div>
  );
}
