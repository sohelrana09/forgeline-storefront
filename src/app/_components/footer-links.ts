import { pagePath } from "@/lib/urls";
import { blogEnabled } from "@/features/blog/service";
import { BLOG_PATH } from "@/features/blog/utils";

// The footer's links: the blog (when Sanity is configured) and every published content page.
export const footerLinks = (pages: { slug: string; title: string }[]) => [
  ...(blogEnabled() ? [{ href: BLOG_PATH, label: "Blog" }] : []),
  ...pages.map((p) => ({ href: pagePath(p.slug), label: p.title })),
];
