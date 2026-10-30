// Make sure to import the helper functions from the `ssr` entry point.
import { entryPointUriPathToPermissionKeys } from '@commercetools-frontend/application-shell/ssr';

export const entryPointUriPath = 'cms-content';

export const PERMISSIONS = entryPointUriPathToPermissionKeys(entryPointUriPath);

// ---- Content model (mirrors src/features/cms/types.ts in the storefront; keep the two in sync) ----

export const CONTAINERS = { blocks: 'cms-block' } as const;
export type TContentKind = keyof typeof CONTAINERS;

export const PLACEMENTS = [
  'home.hero',
  'home.top',
  'home.featured',
  'plp.top',
  'pdp.below-add-to-cart',
  'pdp.bottom',
  'cart.sidebar',
] as const;

export const PLACEMENT_LABELS: Record<(typeof PLACEMENTS)[number], string> = {
  'home.hero': 'Homepage: main banner',
  'home.top': 'Homepage: top',
  'home.featured': 'Homepage: featured',
  'plp.top': 'Category page: top',
  'pdp.below-add-to-cart': 'Product page: below Add to cart',
  'pdp.bottom': 'Product page: bottom',
  'cart.sidebar': 'Cart: sidebar',
};

export const STYLES = ['plain', 'info', 'promo'] as const;
export const BLOCK_TYPES = ['markdown', 'products', 'banner'] as const;
export const THEMES = ['dark', 'light'] as const;

// Media library: uploaded images are images of one hidden, never-published product, which puts them on the
// commercetools CDN (storefront: scripts/media-library.ts creates it). The upload API takes JPEG, PNG and GIF only.
export const MEDIA_PRODUCT_KEY = 'cms-media-library';
export const MEDIA_SKU = 'cms-media-library';
// Same list and check as src/lib/media.ts in the storefront: this project's CDN folder and the sample data bucket.
export const MEDIA_SOURCES = [
  {
    host: 'images.us-east-2.aws.commercetools.com',
    path: '/c189cfd4-9774-40b2-938c-3b62f7cfb6d5/',
  },
  { host: 'storage.googleapis.com', path: '/merchant-center-europe/' },
];
export const isMediaUrl = (url: string) => {
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      MEDIA_SOURCES.some(
        (s) => u.hostname === s.host && u.pathname.startsWith(s.path)
      )
    );
  } catch {
    return false;
  }
};
export const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// Wider pictures are scaled down before upload; nothing on the storefront shows them larger.
export const MAX_IMAGE_WIDTH = 2400;

// Same rules as the storefront's sync script (scripts/sync-content.ts).
export const KEY_PATTERN = /^[a-z0-9-]+$/;
export const SKU_PATTERN = /^[A-Za-z0-9._-]+$/;
export const CTA_HREF_PATTERN = /^(\/(?!\/)|https:)/;
