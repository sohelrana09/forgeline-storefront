// The storefront's public base URL (email links, canonical URLs, sitemap, structured data). Configured, never derived
// from the request, so a forged Host header can't change links or canonicals.
export function siteUrl(): string {
  const url = process.env.SITE_URL;
  if (url) return url.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("SITE_URL is required in production");
  return "http://localhost:3000";
}

// Whether search engines may index the site. Off unless SITE_INDEXABLE=true: a sandbox or demo deployment stays out
// of Google and Bing (noindex on every response, no sitemap). Read at build time too (next.config.ts headers).
export const siteIndexable = () => process.env.SITE_INDEXABLE === "true";
