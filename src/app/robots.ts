import type { MetadataRoute } from "next";
import { siteIndexable, siteUrl } from "@/lib/site-url";

// The public catalog (home, categories, products, content pages) is indexable at guest list prices. Everything
// personal or transactional stays out, and so do search results (endless query URLs, thin content).
export default function robots(): MetadataRoute.Robots {
  // Not indexable: crawlers may still fetch pages (and so see the noindex header next.config.ts sends), but get no
  // sitemap to work through.
  if (!siteIndexable()) return { rules: { userAgent: "*", allow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account",
        "/cart",
        "/checkout",
        "/order-confirmation",
        "/quick-order",
        "/search",
        "/login",
        "/logout",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
        "/no-access",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
