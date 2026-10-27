import { stegaClean } from "next-sanity";
import { siteUrl } from "@/lib/site-url";
import { blogEnabled, getAllPosts } from "@/features/blog/service";
import { BLOG_PATH, postPath } from "@/features/blog/utils";

// RSS 2.0 feed of the 50 newest posts.
const xml = (s = "") => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

export async function GET() {
  if (!blogEnabled()) return new Response("Not found", { status: 404 });
  const posts = (await getAllPosts()).slice(0, 50);
  const base = siteUrl();
  const items = posts
    .map((p) => {
      const url = `${base}${postPath(stegaClean(p.slug))}`;
      return `<item><title>${xml(p.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>${p.excerpt ? `<description>${xml(p.excerpt)}</description>` : ""}${p.categories.map((c) => `<category>${xml(c.title)}</category>`).join("")}</item>`;
    })
    .join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Ironline Supply blog</title><link>${base}${BLOG_PATH}</link><description>News, buying guides and maintenance tips.</description><language>en</language>${items}</channel></rss>`;
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}
