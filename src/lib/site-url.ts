// The storefront's public base URL (email links, canonical URLs, sitemap, structured data). Configured, never derived
// from the request, so a forged Host header can't change links or canonicals.
export function siteUrl(): string {
  const url = process.env.SITE_URL;
  if (url) return url.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("SITE_URL is required in production");
  return "http://localhost:3000";
}
