import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// The public catalog (home, categories, products, content pages) is indexable at guest list prices. Everything
// personal or transactional stays out, and so do search results (endless query URLs, thin content).
export default function robots(): MetadataRoute.Robots {
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
