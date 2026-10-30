// Links from content: internal paths ("/…" but not "//host"), https and mailto only.
export function safeHref(href: unknown): string | undefined {
  if (typeof href !== "string") return undefined;
  return isLocalPath(href) || /^(https:|mailto:)/i.test(href) ? href : undefined;
}

import { isSanityImageUrl } from "@/lib/media";
import { isLocalPath } from "@/lib/urls";
import type { CmsBlock } from "@/features/cms/types";

// A block's optional schedule: live from startsAt (inclusive) until endsAt (exclusive). A date that doesn't parse
// (saved outside the Studio) keeps the block hidden rather than showing it forever.
export function isLive(block: { startsAt?: string | null; endsAt?: string | null }, now = Date.now()): boolean {
  const from = block.startsAt == null ? -Infinity : Date.parse(block.startsAt);
  const until = block.endsAt == null ? Infinity : Date.parse(block.endsAt);
  return from <= now && now < until;
}

export const isBannerImage = isSanityImageUrl;

// Banners the homepage can actually show: a headline and an allowed picture.
export const validBanners = (blocks: CmsBlock[]) => blocks.filter((b) => b.type === "banner" && b.headline && isBannerImage(b.image));
