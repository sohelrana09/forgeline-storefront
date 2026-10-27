import type { PortableTextBlock } from "next-sanity";

// Content model for CMS blocks and pages (no API calls: also used by the sync script).

export const BLOCK_CONTAINER = "cms-block";
export const PAGE_CONTAINER = "cms-page";

// CMS images live on the commercetools CDN as images of one hidden, never-published product (scripts/media-library.ts).
export const MEDIA_PRODUCT_TYPE_KEY = "cms-media";
export const MEDIA_PRODUCT_KEY = "cms-media-library";
export const MEDIA_SKU = "cms-media-library";

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
  // Markdown content, a list of SKUs (a "products" block, like Magento's Catalog Products List widget), or a banner
  // (homepage hero: picture, headline, text in `content`, up to two buttons).
  type: "markdown" | "products" | "banner";
  content?: string;
  skus?: string[];
  cta?: { label: string; href: string };
  // Banner only.
  headline?: string;
  image?: string; // desktop picture, 16:9 or wider
  mobileImage?: string; // optional narrower picture for phones
  imageAlt?: string; // describes the picture; empty when it's decoration
  theme?: "dark" | "light"; // text colour over the picture
  secondaryCta?: { label: string; href: string };
};

// A content page: Markdown `content` from the commercetools Custom Objects (legacy), or a Portable Text `body`
// from Sanity once it is configured.
export type CmsPage = {
  slug: string;
  title: string;
  metaDescription?: string;
  metaTitle?: string;
  active: boolean;
  content?: string;
  body?: PortableTextBlock[];
};

export type BlockQuery = { placement: Placement; storeKey: string; categorySlugs?: string[] };
