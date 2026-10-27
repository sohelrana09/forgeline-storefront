import type { Attribute, LocalizedString, Price, ProductProjection, ProductVariant } from "@commercetools/platform-sdk";

// Pure catalog helpers (no API calls): safe for any component.
import { categoryPath, productPath } from "@/lib/urls";

export const LOCALE = "en-US";

// Storefront URLs (src/lib/urls.ts): a category's path from its trail (top level down to itself), a product at the root.
export const categoryHref = (trail: { slug: LocalizedString }[]) => categoryPath(trail.map((c) => localize(c.slug)));
export const productHref = (slug: LocalizedString | string | undefined, sku?: string) =>
  productPath(typeof slug === "string" ? slug : localize(slug), sku);

export function localize(value: LocalizedString | undefined): string {
  if (!value) return "";
  return value[LOCALE] ?? Object.values(value)[0] ?? "";
}

// Above this a product is quote-only (machines).
export const QUOTE_THRESHOLD_CENTS = 500000;
export const isQuoteOnly = (price?: Price) => (price?.value.centAmount ?? 0) >= QUOTE_THRESHOLD_CENTS;

// EU prices include VAT; US prices are net and sales tax is added at checkout.
export const taxNote = (country?: string) => (country === "US" ? "excl. tax" : "incl. VAT");

// ---------- Variants and attributes ----------

export const allVariants = (p: ProductProjection): ProductVariant[] => [p.masterVariant, ...p.variants];

// The attribute that distinguishes variants: "model" (2015/2019/2023) or "color" (RED/BLUE/GREEN).
export function variantAxis(p: ProductProjection): string | undefined {
  if (p.variants.length === 0) return undefined;
  const names = new Set(p.masterVariant.attributes?.map((a) => a.name));
  return ["model", "color"].find((n) => names.has(n));
}

const HIDDEN_ATTRIBUTES = new Set(["relatedProducts"]);

function attributeLabel(name: string) {
  if (name === "iso45001") return "ISO 45001";
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

// Renders enum / lenum / boolean / number / string attribute values as text.
export function formatAttributeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" || typeof value === "string") return String(value);
  if (Array.isArray(value)) return value.map(formatAttributeValue).join(", ");
  if (typeof value === "object") {
    const v = value as { label?: string | LocalizedString; key?: string };
    if (typeof v.label === "string") return v.label;
    if (v.label) return localize(v.label);
    if (v.key) return v.key;
    return localize(value as LocalizedString);
  }
  return "";
}

export function specRows(variant: ProductVariant) {
  return (variant.attributes ?? [])
    .filter((a: Attribute) => !HIDDEN_ATTRIBUTES.has(a.name))
    .map((a) => ({ name: attributeLabel(a.name), value: formatAttributeValue(a.value) }))
    .filter((r) => r.value !== "");
}

// PDP gallery: every distinct image of the product, in variant order. Each knows which variants use it (`skus`)
// and the first one's model year or color (the sample data has one picture per variant).
export type GalleryImage = { url: string; skus: string[]; kind?: "model" | "color"; value?: string };

export function galleryImages(p: ProductProjection, axis: string | undefined): GalleryImage[] {
  const byUrl = new Map<string, GalleryImage>();
  const kind = axis === "model" ? "model" : axis ? "color" : undefined;
  for (const v of allVariants(p)) {
    const value = axis ? formatAttributeValue(v.attributes?.find((a) => a.name === axis)?.value) || undefined : undefined;
    for (const img of v.images ?? []) {
      const seen = byUrl.get(img.url);
      if (seen) {
        if (v.sku) seen.skus.push(v.sku);
      } else byUrl.set(img.url, { url: img.url, skus: v.sku ? [v.sku] : [], kind: value ? kind : undefined, value });
    }
  }
  return [...byUrl.values()];
}

export function relatedProductIds(p: ProductProjection): string[] {
  const attr = p.masterVariant.attributes?.find((a) => a.name === "relatedProducts");
  const refs = Array.isArray(attr?.value) ? (attr.value as { id?: string }[]) : [];
  return refs.map((r) => r.id).filter((id): id is string => !!id);
}

export function availableQuantity(variant: ProductVariant, supplyChannelId?: string): number | undefined {
  const availability = variant.availability;
  if (!availability) return undefined;
  if (supplyChannelId && availability.channels?.[supplyChannelId]) {
    return availability.channels[supplyChannelId].availableQuantity;
  }
  return availability.availableQuantity;
}

// A plain-text description for <meta name="description"> and social previews: no markdown, one line, ~155 chars.
export function metaDescription(text: string, max = 155): string {
  const plain = text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](url) and images → text
    .replace(/^\s*(?:#{1,6}|[*+-]|>|\d+\.)\s+/gm, "") // headings, list markers, quotes at line start
    .replace(/[*_`]+/g, "") // emphasis and code marks
    .replace(/\s+/g, " ")
    .trim();
  return plain.length <= max ? plain : `${plain.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}
