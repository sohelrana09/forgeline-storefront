// Links from content: internal paths ("/…" but not "//host"), https and mailto only.
export function safeHref(href: unknown): string | undefined {
  if (typeof href !== "string") return undefined;
  return /^\/(?!\/)/.test(href) || /^(https:|mailto:)/i.test(href) ? href : undefined;
}

import { isMediaUrl } from "@/lib/media";
import type { CmsBlock } from "@/features/cms/types";

export { isMediaUrl, MEDIA_SOURCES } from "@/lib/media";

// A block's optional schedule: live from startsAt (inclusive) until endsAt (exclusive). A date that doesn't parse
// (an object saved outside the app and the sync script) keeps the block hidden rather than showing it forever.
export function isLive(block: { startsAt?: string; endsAt?: string }, now = Date.now()): boolean {
  const from = block.startsAt === undefined ? -Infinity : Date.parse(block.startsAt);
  const until = block.endsAt === undefined ? Infinity : Date.parse(block.endsAt);
  return from <= now && now < until;
}

// Banners the homepage can actually show: a headline and a picture from the media library.
export const validBanners = (blocks: CmsBlock[]) => blocks.filter((b) => b.type === "banner" && b.headline && isMediaUrl(b.image));
