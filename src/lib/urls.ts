// Storefront URLs (URL keys, clean paths): every link to a category, product or content page is built
// here, and features/urls resolves incoming paths back to them.
//   category  /excavators/wheeled-excavators   (the category's path in the tree)
//   product   /jj234-wx  (?sku= for a variant)  (root level, one URL whatever the category)
//   page      /delivery-information
// URL keys are the commercetools slugs in lowercase with hyphens: slugs allow [A-Za-z0-9_-], and the sample data
// uses underscores. Pure (no imports): the header, footer and proxy use it too.

// A path on this site, read the way a browser reads it: "//host", "/\host" and "/<tab>/host" (browsers drop tabs and
// newlines) all lead to another site.
const SAME_SITE = "https://same-site.invalid";
export function isLocalPath(href: string): boolean {
  if (!href.startsWith("/")) return false;
  try {
    return new URL(href, SAME_SITE).origin === SAME_SITE;
  } catch {
    return false;
  }
}

export const urlKey = (slug: string) => slug.trim().toLowerCase().replace(/_/g, "-");

export const productPath = (slug: string, sku?: string) => `/${urlKey(slug)}${sku ? `?sku=${encodeURIComponent(sku)}` : ""}`;

// The category's slugs from the top-level category down to itself.
export const categoryPath = (slugs: string[]) => `/${slugs.map(urlKey).join("/")}`;

export const pagePath = (slug: string) => `/${urlKey(slug)}`;

// First path segments that belong to the app's own routes. Catalog URLs never use them (a category, product or page
// with such a key is reported by `npm run ct:urls` and left out), and the proxy never treats them as catalog URLs.
export const RESERVED_SEGMENTS = new Set([
  "account",
  "api",
  "blog",
  "cart",
  "checkout",
  "forgot-password",
  "g",
  "login",
  "logout",
  "no-access",
  "order-confirmation",
  "quick-order",
  "register",
  "reset-password",
  "search",
  "studio",
  "verify-email",
  "_next",
]);

// The canonical form of a requested path: decoded, lowercase, single slashes, no trailing slash.
export function normalizePath(path: string): string {
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // Keep it as it came.
  }
  const segments = decoded
    .toLowerCase()
    .split("/")
    .filter((s) => s !== "");
  return `/${segments.join("/")}`;
}
