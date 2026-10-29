import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryTree, getProductBySlug, getProductsByIds, getProductsInCategories } from "@/features/catalog/service";
import {
  allVariants,
  availableQuantity,
  formatAttributeValue,
  galleryImages,
  isQuoteOnly,
  localize,
  relatedProductIds,
  specRows,
  variantAxis,
  categoryHref,
  productHref,
} from "@/features/catalog/utils";
import { taxNote } from "@/features/catalog/utils";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/ui/JsonLd";
import { productJsonLd } from "@/features/catalog/seo";
import { PriceTag } from "@/features/catalog/components/PriceTag";
import { TierPrices } from "@/features/catalog/components/TierPrices";
import { ProductGallery } from "@/features/catalog/components/ProductGallery";
import { AddToCartForm } from "@/features/cart/components/AddToCartForm";
import { AddToListPanel } from "@/features/purchase-lists/components/AddToListPanel";
import { Carousel } from "@/components/ui/Carousel";
import { ProductCard } from "@/features/catalog/components/ProductCard";
import { CmsBlocks } from "@/features/cms/components/CmsBlocks";
import type { BuyerContext } from "@/features/business-units/types";

export async function ProductView({ context, slug, sku }: { context: BuyerContext; slug: string; sku?: string }) {
  const product = await getProductBySlug(context, slug);
  if (!product) notFound();

  const variants = allVariants(product);
  const variant = variants.find((v) => v.sku === sku) ?? product.masterVariant;
  const axis = variantAxis(product);
  const name = localize(product.name);
  const categoryIds = product.categories.map((c) => c.id);
  const [tree, compatible, sameCategory] = await Promise.all([
    getCategoryTree(),
    // "Compatible spare parts": the product's relatedProducts attribute (curated in Merchant Center).
    getProductsByIds(context, relatedProductIds(product)),
    // "More in this category": automatic related products from the same leaf category.
    categoryIds.length ? getProductsInCategories(context, categoryIds, { limit: 13 }) : undefined,
  ]);
  const category = product.categories[0] && tree.all.find((c) => c.id === product.categories[0].id);
  const categorySlugs = product.categories
    .map((ref) => tree.all.find((c) => c.id === ref.id))
    .flatMap((c) => (c ? [...tree.ancestors(c), c].map((x) => localize(x.slug)) : []));
  const moreInCategory = (sameCategory?.results ?? []).filter((p) => p.id !== product.id).slice(0, 12);
  const stock = availableQuantity(variant, context.supplyChannelId);
  const description = localize(product.description);
  const specs = specRows(variant);
  const note = taxNote(context.country);

  return (
    <div className="flex flex-col gap-8">
      {/* Structured data only in the guest view (what crawlers see): company contract prices never go into markup. */}
      {context.guest && (
        <JsonLd data={productJsonLd(product, variant, category ? [...tree.ancestors(category), category] : [], context.supplyChannelId)} />
      )}
      <Breadcrumbs
        items={[
          ...(category
            ? [...tree.ancestors(category), category].map((c, i, all) => ({
                label: localize(c.name),
                href: categoryHref(all.slice(0, i + 1)),
              }))
            : []),
          { label: name },
        ]}
      />

      <div className="grid items-start gap-8 md:grid-cols-2">
        {/* Sized to the gallery, not stretched to the details column; stays in view while the details scroll. */}
        <div className="rounded-md border border-gray-200 bg-white p-6 md:sticky md:top-4">
          <ProductGallery key={variant.sku} images={galleryImages(product, axis)} name={name} slug={slug} selectedSku={variant.sku} />
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <h1 className="m-0 text-3xl font-bold">{name}</h1>
            <p className="m-0 mt-1 font-mono text-sm text-gray-600">SKU {variant.sku}</p>
          </div>

          <PriceTag price={variant.price} note={note} size="lg" />
          <TierPrices price={variant.price} />

          {axis && (
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-2 text-sm font-semibold">{axis === "model" ? "Model year" : "Color"}</legend>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => {
                  const label = formatAttributeValue(v.attributes?.find((a) => a.name === axis)?.value) || v.sku;
                  const selected = v.sku === variant.sku;
                  return (
                    <Link
                      key={v.sku}
                      href={productHref(slug, v.sku)}
                      aria-current={selected ? "true" : undefined}
                      className={`min-w-16 rounded border px-4 py-2.5 text-center text-sm no-underline ${
                        selected
                          ? "border-orange-700 bg-orange-50 font-semibold text-orange-900"
                          : "border-gray-300 bg-white text-gray-800 hover:border-gray-500"
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            </fieldset>
          )}

          <p className="m-0 text-sm">
            {stock === undefined ? (
              <span className="text-gray-600">Availability on request</span>
            ) : stock > 0 ? (
              <span className="font-semibold text-green-800">In stock · {stock} available</span>
            ) : (
              <span className="font-semibold text-red-800">Out of stock</span>
            )}
          </p>

          {variant.sku && (
            <AddToCartForm
              sku={variant.sku}
              name={name}
              canOrder={context.canOrder}
              canQuote={!context.consumer}
              quoteOnly={isQuoteOnly(variant.price)}
              size="lg"
            />
          )}
          {variant.sku && <AddToListPanel context={context} kind="product" sku={variant.sku} />}
          {isQuoteOnly(variant.price) && (
            <p className="m-0 text-sm text-gray-600">Machines are sold on quote, including delivery and commissioning.</p>
          )}

          <CmsBlocks placement="pdp.below-add-to-cart" context={context} categorySlugs={categorySlugs} />

          {description && <p className="m-0 leading-relaxed text-gray-700">{description}</p>}

          {specs.length > 0 && (
            <section aria-labelledby="specs">
              <h2 id="specs" className="mb-2 mt-0 text-lg font-semibold">
                Specifications
              </h2>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {specs.map((row) => (
                    <tr key={row.name} className="border-t border-gray-200">
                      <th scope="row" className="w-1/3 py-2 pr-4 text-left font-medium text-gray-600">
                        {row.name}
                      </th>
                      <td className="py-2">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      </div>

      {compatible.length > 0 && (
        <section aria-labelledby="compatible">
          <h2 id="compatible" className="mb-4 mt-0 text-xl font-semibold">
            Compatible spare parts
          </h2>
          <Carousel label="Compatible spare parts">
            {compatible.map((p) => (
              <ProductCard key={p.id} product={p} canOrder={context.canOrder} canQuote={!context.consumer} note={note} />
            ))}
          </Carousel>
        </section>
      )}

      {moreInCategory.length > 0 && category && (
        <section aria-labelledby="related">
          <h2 id="related" className="mb-4 mt-0 text-xl font-semibold">
            More in {localize(category.name)}
          </h2>
          <Carousel label={`More in ${localize(category.name)}`}>
            {moreInCategory.map((p) => (
              <ProductCard key={p.id} product={p} canOrder={context.canOrder} canQuote={!context.consumer} note={note} />
            ))}
          </Carousel>
        </section>
      )}

      <CmsBlocks placement="pdp.bottom" context={context} categorySlugs={categorySlugs} />
    </div>
  );
}
