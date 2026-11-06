import "server-only";
import type { ProductProjection, ProductVariant } from "@commercetools/platform-sdk";
import { parseLadder, toPrice } from "@/features/company-pricing/ladder";
import { priceKey, readLadderFields } from "@/features/company-pricing/store";
import type { Ladder } from "@/features/company-pricing/types";

// Company prices from the external price service (here: SAP's calculated prices). Stores marked `externalPricing`
// (STORE_PRICING in features/business-units/service.ts) give their units' buying context `externalPriceCompany`
// (the unit key = SAP CardCode). Catalog reads stay price-selected and cached per store (the web price); these
// helpers lay the company's prices over them per visitor. Carts get the same prices from the API Extension
// (/api/price-extension), so what the page shows is what the cart charges.

export type CompanyPricing = { externalPriceCompany?: string; currency: string };

// The company's ladders for these SKUs (missing SKUs have none). `live` for the extension; pages read through a
// 60-second per-process memo (an import is visible within a minute, like the other per-process memos).
const DISPLAY_TTL_MS = 60 * 1000;
const DISPLAY_MAX = 50_000;
const displayCache = new Map<string, { at: number; ladder?: Ladder }>();

// Oldest first (a Map keeps insertion order), so one process can't grow without limit on a big company catalog.
function remember(key: string, entry: { at: number; ladder?: Ladder }) {
  displayCache.delete(key);
  displayCache.set(key, entry);
  if (displayCache.size > DISPLAY_MAX) displayCache.delete(displayCache.keys().next().value as string);
}

export async function companyLadders(cardCode: string, skus: string[], { live = false } = {}): Promise<Map<string, Ladder>> {
  const ladders = new Map<string, Ladder>();
  const now = Date.now();
  const missing: string[] = [];
  for (const sku of new Set(skus)) {
    const hit = live ? undefined : displayCache.get(priceKey(cardCode, sku));
    if (hit && now - hit.at < DISPLAY_TTL_MS) {
      if (hit.ladder) ladders.set(sku, hit.ladder);
    } else missing.push(sku);
  }
  const fields = await readLadderFields(missing.map((sku) => priceKey(cardCode, sku)));
  missing.forEach((sku, i) => {
    const ladder = parseLadder(fields[i]);
    if (ladder) ladders.set(sku, ladder);
    remember(priceKey(cardCode, sku), { at: now, ladder });
  });
  return ladders;
}

// Ladders for display: a failing price store shows the web price (logged); the cart's extension refuses instead.
async function displayLadders(company: string, skus: string[]): Promise<Map<string, Ladder>> {
  try {
    return await companyLadders(company, skus);
  } catch (err) {
    console.error("company prices unavailable, showing web prices", company, err);
    return new Map();
  }
}

const variantsOf = (p: ProductProjection) => [p.masterVariant, ...p.variants];

// The products with each variant's price replaced by the company's ladder (base value + tiers), so every view that
// shows standalone prices (cards, tiers, "As low as", the layered price filter) shows the company price unchanged.
export async function withCompanyPrices(ctx: CompanyPricing, products: ProductProjection[]): Promise<ProductProjection[]> {
  const company = ctx.externalPriceCompany;
  if (!company || products.length === 0) return products;
  const ladders = await displayLadders(
    company,
    products.flatMap((p) => variantsOf(p).flatMap((v) => (v.sku ? [v.sku] : []))),
  );
  if (ladders.size === 0) return products;
  const priced = (v: ProductVariant): ProductVariant => {
    const ladder = v.sku ? ladders.get(v.sku) : undefined;
    return ladder ? { ...v, price: toPrice(ladder, ctx.currency) } : v;
  };
  return products.map((p) => ({ ...p, masterVariant: priced(p.masterVariant), variants: p.variants.map(priced) }));
}

export async function withCompanyPrice(ctx: CompanyPricing, product: ProductProjection | undefined) {
  return product ? (await withCompanyPrices(ctx, [product]))[0] : undefined;
}

// For lists keyed by SKU (search suggestions, quick order lookups): the company's base price per SKU.
export async function companyBasePrices(ctx: CompanyPricing, skus: string[]) {
  const company = ctx.externalPriceCompany;
  if (!company || skus.length === 0) return new Map<string, ReturnType<typeof toPrice>>();
  const ladders = await displayLadders(company, skus);
  return new Map([...ladders].map(([sku, ladder]) => [sku, toPrice(ladder, ctx.currency)]));
}
