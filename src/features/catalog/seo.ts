import type { Category, ProductProjection, ProductVariant } from "@commercetools/platform-sdk";
import { siteUrl } from "@/lib/site-url";
import { availableQuantity, categoryHref, isQuoteOnly, localize, metaDescription, productHref } from "@/features/catalog/utils";

// schema.org data for the product page (guest view, which is what crawlers see).
export function productJsonLd(product: ProductProjection, variant: ProductVariant, trail: Category[], supplyChannelId?: string) {
  const base = siteUrl();
  const url = `${base}${productHref(product.slug)}`;
  const price = variant.price?.discounted?.value ?? variant.price?.value;
  const stock = availableQuantity(variant, supplyChannelId);
  const description = metaDescription(localize(product.description), 5000);
  return [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: localize(product.name),
      sku: variant.sku,
      url,
      ...(description && { description }),
      ...((variant.images ?? product.masterVariant.images ?? []).length > 0 && {
        image: (variant.images ?? product.masterVariant.images ?? []).map((i) => i.url),
      }),
      brand: { "@type": "Brand", name: "Ironline Supply" },
      // Machines are priced on quote: no public offer for them.
      ...(price &&
        !isQuoteOnly(variant.price) && {
          offers: {
            "@type": "Offer",
            url,
            price: (price.centAmount / 10 ** price.fractionDigits).toFixed(price.fractionDigits),
            priceCurrency: price.currencyCode,
            availability: stock === undefined || stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
          },
        }),
    },
    breadcrumbJsonLd([
      ...trail.map((c, i) => ({ name: localize(c.name), url: `${base}${categoryHref(trail.slice(0, i + 1))}` })),
      { name: localize(product.name), url },
    ]),
  ];
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// Page metadata, shared by the per-visitor routes and the cached guest copies (canonicals always use the public path).
export function productMetadata(product: ProductProjection) {
  const name = localize(product.name);
  const description = metaDescription(localize(product.description)) || `${name} from Ironline Supply.`;
  const image = product.masterVariant.images?.[0];
  const path = productHref(product.slug);
  return {
    title: name,
    description,
    // One URL per product: ?sku= variants point to the product page.
    alternates: { canonical: path },
    openGraph: { title: name, description, url: path, ...(image && { images: [{ url: image.url, alt: name }] }) },
  };
}

// `trail`: the category's ancestors and itself, for its path.
export function categoryMetadata(trail: Category[], page = 1) {
  const category = trail[trail.length - 1];
  const name = localize(category.name);
  const description =
    metaDescription(localize(category.description)) || `${name} from Ironline Supply: prices, stock and specifications for every model.`;
  // Self-referencing canonical per page (sort orders point to the default order).
  const canonical = `${categoryHref(trail)}${page > 1 ? `?page=${page}` : ""}`;
  return {
    title: page > 1 ? `${name} (page ${page})` : name,
    description,
    alternates: { canonical },
    openGraph: { title: name, description, url: canonical },
  };
}
