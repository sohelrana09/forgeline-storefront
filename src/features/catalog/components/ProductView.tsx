import { Suspense } from "react";
import Link from "next/link";
import type { Category, ProductProjection } from "@commercetools/platform-sdk";
import { notFound } from "next/navigation";
import {
  getCategoryTree,
  getProductBySlug,
  getProductContent,
  getProductsByIds,
  getProductsInCategories,
} from "@/features/catalog/service";
import { requireBrowseContext } from "@/features/business-units/context";
import { Message } from "@/components/ui/Message";
import { firstParam } from "@/lib/utils";
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

type ProductQuery = Promise<{ sku?: string | string[] }>;

// The product page. The shell (breadcrumbs, name, pictures, description) is the same for every visitor and comes from
// the price-free cached read, so it is prerendered and arrives with the first byte. Everything that depends on the
// visitor (prices, stock, cart, lists, guest-only JSON-LD) or on the selected variant (?sku: SKU line, variant
// pictures, specifications) streams in behind <Suspense>.
export async function ProductView({ slug, query }: { slug: string; query: ProductQuery }) {
  const [product, tree] = await Promise.all([getProductContent(slug), getCategoryTree()]);
  if (!product) notFound();

  const axis = variantAxis(product);
  const name = localize(product.name);
  const category = product.categories[0] && tree.all.find((c) => c.id === product.categories[0].id);
  const trail = category ? [...tree.ancestors(category), category] : [];
  const description = localize(product.description);
  const images = galleryImages(product, axis);
  // Every category the product is in, with its ancestors: CMS blocks can target any of them.
  const categorySlugs = product.categories
    .map((ref) => tree.all.find((c) => c.id === ref.id))
    .flatMap((c) => (c ? [...tree.ancestors(c), c].map((x) => localize(x.slug)) : []));

  return (
    <div className="flex flex-col gap-8">
      <Breadcrumbs
        items={[...trail.map((c, i, all) => ({ label: localize(c.name), href: categoryHref(all.slice(0, i + 1)) })), { label: name }]}
      />

      <div className="grid items-start gap-8 md:grid-cols-2">
        {/* Sized to the gallery, not stretched to the details column; stays in view while the details scroll. */}
        <div className="rounded-md border border-gray-200 bg-white p-6 md:sticky md:top-4">
          {/* The master variant's pictures in the shell; a ?sku URL swaps in its variant's when the URL is read. */}
          <Suspense fallback={<ProductGallery images={images} name={name} slug={slug} selectedSku={product.masterVariant.sku} />}>
            <VariantGallery product={product} query={query} />
          </Suspense>
        </div>

        <div className="flex flex-col gap-5">
          <h1 className="m-0 text-3xl font-bold">{name}</h1>
          <Suspense fallback={<BuyBoxSkeleton />}>
            <BuyBox product={product} query={query} trail={trail} categorySlugs={categorySlugs} />
          </Suspense>

          {description && <p className="m-0 leading-relaxed text-gray-700">{description}</p>}

          <Suspense fallback={null}>
            <Specifications product={product} query={query} />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={null}>
        <BelowProduct product={product} trail={trail} categorySlugs={categorySlugs} />
      </Suspense>
    </div>
  );
}

const selectedVariant = (product: ProductProjection, sku: string | string[] | undefined) =>
  allVariants(product).find((v) => v.sku === firstParam(sku)) ?? product.masterVariant;

async function VariantGallery({ product, query }: { product: ProductProjection; query: ProductQuery }) {
  const variant = selectedVariant(product, (await query).sku);
  const name = localize(product.name);
  return (
    <ProductGallery
      key={variant.sku}
      images={galleryImages(product, variantAxis(product))}
      name={name}
      slug={localize(product.slug)}
      selectedSku={variant.sku}
    />
  );
}

// The size of the streamed part below the name, so the description doesn't jump down when it arrives.
function BuyBoxSkeleton() {
  return (
    <div role="status" aria-label="Loading price" className="flex animate-pulse flex-col gap-4">
      <div className="h-4 w-40 rounded bg-gray-200" />
      <div className="h-9 w-32 rounded bg-gray-200" />
      <div className="h-11 w-full rounded bg-gray-200" />
    </div>
  );
}

// SKU line, price, tiers, variant choice, stock, add to cart and to a list, for this visitor and the selected variant.
// Priced for the visitor's store: a product outside it (a buyer of another store) says so instead of a price.
async function BuyBox({
  product,
  query,
  trail,
  categorySlugs,
}: {
  product: ProductProjection;
  query: ProductQuery;
  trail: Category[];
  categorySlugs: string[];
}) {
  const [{ sku }, { context }] = await Promise.all([query, requireBrowseContext()]);
  const slug = localize(product.slug);
  const priced = await getProductBySlug(context, slug);
  if (!priced) return <Message type="warning">{`This product isn't sold in ${context.storeName}.`}</Message>;

  const variants = allVariants(priced);
  const variant = selectedVariant(priced, sku);
  const axis = variantAxis(priced);
  const name = localize(priced.name);
  const stock = availableQuantity(variant, context.supplyChannelId);
  const note = taxNote(context.country);

  return (
    <>
      {/* Structured data only in the guest view (what crawlers see): company contract prices never go into markup. */}
      {context.guest && <JsonLd data={productJsonLd(priced, variant, trail, context.supplyChannelId)} />}
      <p className="m-0 -mt-4 font-mono text-sm text-gray-600">SKU {variant.sku}</p>

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
      {variant.sku && (
        <Suspense fallback={null}>
          <AddToListPanel context={context} kind="product" sku={variant.sku} />
        </Suspense>
      )}
      {isQuoteOnly(variant.price) && (
        <p className="m-0 text-sm text-gray-600">Machines are sold on quote, including delivery and commissioning.</p>
      )}

      <CmsBlocks placement="pdp.below-add-to-cart" context={context} categorySlugs={categorySlugs} />
    </>
  );
}

// The selected variant's attributes; the same for every visitor, but the variant comes from the URL.
async function Specifications({ product, query }: { product: ProductProjection; query: ProductQuery }) {
  const specs = specRows(selectedVariant(product, (await query).sku));
  if (specs.length === 0) return null;
  return (
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
  );
}

// The carousels and the bottom CMS block, priced and targeted for the visitor.
async function BelowProduct({ product, trail, categorySlugs }: { product: ProductProjection; trail: Category[]; categorySlugs: string[] }) {
  const { context } = await requireBrowseContext();
  const category = trail.at(-1);
  return (
    <>
      <Suspense fallback={null}>
        <RelatedProducts
          context={context}
          product={product}
          categoryIds={product.categories.map((c) => c.id)}
          categoryName={category && localize(category.name)}
        />
      </Suspense>
      <CmsBlocks placement="pdp.bottom" context={context} categorySlugs={categorySlugs} />
    </>
  );
}

// "Compatible spare parts" (the relatedProducts attribute, curated in Merchant Center) and "More in <category>" (the
// same leaf category).
async function RelatedProducts({
  context,
  product,
  categoryIds,
  categoryName,
}: {
  context: BuyerContext;
  product: ProductProjection;
  categoryIds: string[];
  categoryName?: string;
}) {
  const [compatible, sameCategory] = await Promise.all([
    getProductsByIds(context, relatedProductIds(product)),
    categoryIds.length ? getProductsInCategories(context, categoryIds, { limit: 13 }) : undefined,
  ]);
  const moreInCategory = (sameCategory?.results ?? []).filter((p) => p.id !== product.id).slice(0, 12);
  const note = taxNote(context.country);
  return (
    <>
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

      {moreInCategory.length > 0 && categoryName && (
        <section aria-labelledby="related">
          <h2 id="related" className="mb-4 mt-0 text-xl font-semibold">
            More in {categoryName}
          </h2>
          <Carousel label={`More in ${categoryName}`}>
            {moreInCategory.map((p) => (
              <ProductCard key={p.id} product={p} canOrder={context.canOrder} canQuote={!context.consumer} note={note} />
            ))}
          </Carousel>
        </section>
      )}
    </>
  );
}
