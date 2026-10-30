import type { PortableTextBlock } from "next-sanity";

// Content model for CMS blocks and pages (Sanity documents, mapped in service.ts; no API calls).

// Where a block can appear. Add a placement here and render <CmsBlocks placement="…"> where it should show.
export const PLACEMENTS = [
  "home.hero",
  "home.top",
  "home.featured",
  "plp.top",
  "pdp.below-add-to-cart",
  "pdp.bottom",
  "cart.sidebar",
] as const;
export type Placement = (typeof PLACEMENTS)[number];

export const PLACEMENT_LABELS: Record<Placement, string> = {
  "home.hero": "Homepage: main banner",
  "home.top": "Homepage: top",
  "home.featured": "Homepage: featured",
  "plp.top": "Category page: top",
  "pdp.below-add-to-cart": "Product page: below Add to cart",
  "pdp.bottom": "Product page: bottom",
  "cart.sidebar": "Cart: sidebar",
};

export type CmsBlock = {
  identifier: string;
  title?: string;
  active: boolean;
  placement: Placement;
  sortOrder?: number;
  style?: "plain" | "info" | "promo";
  // Optional targeting; empty means everywhere.
  stores?: string[];
  categories?: string[]; // category slugs (matches the page's category or any of its ancestors)
  // Shown only between these times (ISO 8601), for campaigns. Cached guest pages follow within about 6 minutes
  // (60 s content memo + 5 min page cache); signed-in pages within a minute.
  startsAt?: string;
  endsAt?: string;
  // Rich text (`body`), a list of SKUs (a "products" block), or a banner (homepage hero: picture, headline, text in
  // `content`, up to two buttons).
  type: "text" | "products" | "banner";
  body?: PortableTextBlock[];
  content?: string;
  skus?: string[];
  cta?: { label: string; href: string };
  // Banner only.
  headline?: string;
  image?: string; // desktop picture, 16:9 or wider
  mobileImage?: string;
  imageAlt?: string; // describes the picture; empty when it's decoration
  theme?: "dark" | "light"; // text colour over the picture
  secondaryCta?: { label: string; href: string };
};

// A content page from Sanity (Portable Text `body`; lists leave it out).
export type CmsPage = {
  slug: string;
  title: string;
  metaDescription?: string;
  metaTitle?: string;
  active: boolean;
  body?: PortableTextBlock[];
};

export type BlockQuery = { placement: Placement; storeKey: string; categorySlugs?: string[] };
