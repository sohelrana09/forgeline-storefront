import { pagePath } from "@/lib/urls";
import { blogEnabled } from "@/features/blog/service";
import { BLOG_PATH } from "@/features/blog/utils";
import { analyticsContainer, CONSENT_SETTINGS_HASH } from "@/features/analytics/config";

// The footer's links: the blog (when Sanity is configured), every published content page, and the consent banner
// again when analytics is on.
export const footerLinks = (pages: { slug: string; title: string }[]) => [
  ...(blogEnabled() ? [{ href: BLOG_PATH, label: "Blog" }] : []),
  ...pages.map((p) => ({ href: pagePath(p.slug), label: p.title })),
  ...(analyticsContainer() ? [{ href: CONSENT_SETTINGS_HASH, label: "Cookie settings" }] : []),
];
