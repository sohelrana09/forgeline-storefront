// Product Search API request bodies (POST /products/search), used when CATALOG_SEARCH=product-search (activate the API
// in Merchant Center first). Ranked like search.ts: every word must match; name over description; SKUs in any case;
// longer words allow a typo.
import type { ProductSearchRequest, SearchQuery } from "@commercetools/platform-sdk";
import { words } from "@/features/catalog/search";

export const productSearchEnabled = () => process.env.CATALOG_SEARCH === "product-search";

export type ProductSearchPricing = {
  storeId?: string;
  storeKey: string;
  currency: string;
  channelId?: string;
  country?: string;
  customerGroupId?: string;
};

const fuzzyLevel = (w: string) => (w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0);

function wordQuery(word: string, locale: string): SearchQuery {
  const level = fuzzyLevel(word);
  return {
    or: [
      { exact: { field: "variants.sku", value: word, caseInsensitive: true, boost: 10 } },
      { fullText: { field: "name", language: locale, value: word, boost: 5 } },
      ...(level > 0 ? [{ fuzzy: { field: "name", language: locale, value: word, level, boost: 2 } }] : []),
      { fullText: { field: "description", language: locale, value: word } },
    ],
  } as SearchQuery;
}

export function productSearchRequest(
  query: string,
  pricing: ProductSearchPricing,
  { offset, limit, locale }: { offset: number; limit: number; locale: string },
): ProductSearchRequest | undefined {
  const qs = words(query).slice(0, 10);
  if (qs.length === 0) return undefined;
  const parts: SearchQuery[] = [
    // The store's assortment, like the product page.
    ...(pricing.storeId ? [{ exact: { field: "stores", value: pricing.storeId } } as SearchQuery] : []),
    ...qs.map((w) => wordQuery(w, locale)),
  ];
  return {
    query: parts.length === 1 ? parts[0] : ({ and: parts } as SearchQuery),
    offset,
    limit,
    productProjectionParameters: {
      storeProjection: pricing.storeKey,
      priceCurrency: pricing.currency,
      ...(pricing.channelId && { priceChannel: pricing.channelId }),
      ...(pricing.country && { priceCountry: pricing.country }),
      ...(pricing.customerGroupId && { priceCustomerGroup: pricing.customerGroupId }),
    },
  };
}
