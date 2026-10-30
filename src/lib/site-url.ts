// The storefront's public base URL (email links, canonical URLs, sitemap, structured data). Configured, never derived
// from the request, so a forged Host header can't change links or canonicals.
export function siteUrl(): string {
  const url = process.env.SITE_URL;
  if (url) return url.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("SITE_URL is required in production");
  return "http://localhost:3000";
}

// The picture shown when a page without its own image is shared (link previews on LinkedIn, Slack, X). A page that sets
// `openGraph` replaces the whole parent object, so pages with their own Open Graph data add this one themselves.
export const SHARE_IMAGE = { url: "/og-image.jpg", width: 1200, height: 630, alt: "Ironline Supply: heavy machines and spare parts" };

// Whether search engines may index the site. Off unless SITE_INDEXABLE=true: a sandbox or demo deployment stays out
// of Google and Bing (noindex on every response, no sitemap). Read at build time too (next.config.ts headers).
export const siteIndexable = () => process.env.SITE_INDEXABLE === "true";
