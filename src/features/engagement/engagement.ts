// B2C engagement helpers (docs/features/b2c-engagement.md), pure and unit-tested.

import { productImagesBase, SAMPLE_IMAGES_BASE } from "@/lib/image-hosts";

type Money = { centAmount: number; currencyCode: string; fractionDigits: number };

// ---------- Free shipping ----------
// commercetools waives a shipping rate's price once the cart's line total reaches its freeAbove.

export type FreeShipping =
  { state: "free"; threshold: Money } | { state: "remaining"; remaining: Money; percent: number; threshold: Money };

export function freeShippingProgress(linesTotal: Money, freeAbove: Money | undefined): FreeShipping | undefined {
  if (!freeAbove || freeAbove.currencyCode !== linesTotal.currencyCode || freeAbove.centAmount <= 0) return undefined;
  if (linesTotal.centAmount >= freeAbove.centAmount) return { state: "free", threshold: freeAbove };
  return {
    state: "remaining",
    remaining: { ...freeAbove, centAmount: freeAbove.centAmount - linesTotal.centAmount },
    percent: Math.max(0, Math.min(99, Math.floor((linesTotal.centAmount / freeAbove.centAmount) * 100))),
    threshold: freeAbove,
  };
}

// ---------- Recently viewed ----------
// Kept in the visitor's browser only (localStorage): product URL key, SKU, name and picture, newest first.

export type Viewed = { slug: string; sku?: string; name: string; image?: string };
export const VIEWED_MAX = 12;

// Only this project's picture hosts (next.config.ts images.remotePatterns): anything else is dropped, so a tampered
// list can't make the image optimizer fetch elsewhere.
const IMAGE_HOSTS = [SAMPLE_IMAGES_BASE, productImagesBase()];
const safeImage = (url: unknown) =>
  typeof url === "string" && IMAGE_HOSTS.some((h) => url.startsWith(h)) && !url.includes("..") ? url : undefined;

export function parseViewed(raw: string | null | undefined): Viewed[] {
  try {
    const list = JSON.parse(raw ?? "[]");
    if (!Array.isArray(list)) return [];
    return list
      .filter((v) => v && typeof v.slug === "string" && /^[a-z0-9-]{1,100}$/.test(v.slug) && typeof v.name === "string")
      .map((v) => ({
        slug: v.slug,
        sku: typeof v.sku === "string" && /^[A-Za-z0-9._-]{1,64}$/.test(v.sku) ? v.sku : undefined,
        name: v.name.slice(0, 120),
        image: safeImage(v.image),
      }))
      .slice(0, VIEWED_MAX);
  } catch {
    return [];
  }
}

export function rememberViewed(list: Viewed[], item: Viewed): Viewed[] {
  return [item, ...list.filter((v) => v.slug !== item.slug)].slice(0, VIEWED_MAX);
}
