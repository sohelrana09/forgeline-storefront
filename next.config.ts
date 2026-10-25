import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Images go through the optimizer only from these exact hosts (a wildcard would make it an open image proxy):
  // the sample data's bucket, and the commercetools CDN folder that holds uploaded CMS images (MEDIA_SOURCES in src/lib/media.ts).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "storage.googleapis.com", pathname: "/merchant-center-europe/**" },
      // This project's folder only: the CDN host is shared by every commercetools project.
      { protocol: "https", hostname: "images.us-east-2.aws.commercetools.com", pathname: "/c189cfd4-9774-40b2-938c-3b62f7cfb6d5/**" },
    ],
  },
  // Pages whose URL carries a one-time token: never leak it in a Referer header, never cache the page.
  async headers() {
    return ["/reset-password", "/verify-email"].map((source) => ({
      source,
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Cache-Control", value: "no-store" },
      ],
    }));
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

export default nextConfig;
