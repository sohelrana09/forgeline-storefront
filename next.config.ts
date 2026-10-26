import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

// Sent with every response. The CSP only covers what can't break the pages (framing, plugins, <base>, form
// targets); a script-src policy needs nonces for Next's inline scripts and the Checkout SDK hosts first.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HTTPS only in production builds; a dev server on http://localhost must not pin itself.
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
  // Out of search engines unless SITE_INDEXABLE=true (siteIndexable() in src/lib/site-url.ts; robots.txt and the
  // sitemap follow the same switch). Crawling stays allowed so crawlers can see this header: a page blocked in
  // robots.txt can still be listed from links elsewhere.
  ...(process.env.SITE_INDEXABLE === "true" ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Images go through the optimizer only from these exact hosts (a wildcard would make it an open image proxy):
  // the sample data's bucket, and the commercetools CDN folder that holds uploaded CMS images (MEDIA_SOURCES in src/lib/media.ts).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "storage.googleapis.com", pathname: "/merchant-center-europe/**" },
      // This project's folder only: the CDN host is shared by every commercetools project.
      { protocol: "https", hostname: "images.us-east-2.aws.commercetools.com", pathname: "/c189cfd4-9774-40b2-938c-3b62f7cfb6d5/**" },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Pages whose URL carries a one-time token: never leak it in a Referer header, never cache the page.
      ...["/reset-password", "/verify-email"].map((source) => ({
        source,
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      })),
    ];
  },
  // Orders and quotes moved into the customer account (Magento style); old links keep working.
  async redirects() {
    return [
      { source: "/orders/:id", destination: "/account/orders/:id", permanent: true },
      { source: "/quotes", destination: "/account/quotes", permanent: true },
      { source: "/quotes/:path*", destination: "/account/quotes/:path*", permanent: true },
    ];
  },
};

// Vercel BotID: proxies its challenge script and API through this site (Vercel routes them itself in production;
// needed for local development and other hosts) and lets that one path be framed by this site.
export default withBotId(nextConfig);
