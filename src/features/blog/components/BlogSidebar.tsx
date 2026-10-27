import Link from "next/link";
import { getBlogCategories, getRecentPosts, getTags } from "@/features/blog/service";
import { blogCategoryPath, blogTagPath, formatPostDate, postPath } from "@/features/blog/utils";

// Magefan-style blog sidebar: categories with counts, recent posts, tag cloud, RSS.
export async function BlogSidebar({ current }: { current?: { category?: string; tag?: string } }) {
  const [categories, recent, tags] = await Promise.all([
    getBlogCategories().catch(() => []),
    getRecentPosts(5).catch(() => []),
    getTags().catch(() => []),
  ]);
  const heading = "mb-2 mt-0 text-sm font-semibold uppercase tracking-wide text-gray-700";
  return (
    <aside className="flex flex-col gap-6 text-sm" aria-label="Blog">
      {categories.some((c) => c.count) && (
        <nav aria-label="Blog categories">
          <h2 className={heading}>Categories</h2>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {categories
              .filter((c) => c.count)
              .map((c) => (
                <li key={c.slug}>
                  <Link
                    href={blogCategoryPath(c.slug)}
                    aria-current={current?.category === c.slug ? "page" : undefined}
                    className="text-gray-800 no-underline hover:text-orange-800 aria-[current=page]:font-semibold aria-[current=page]:text-orange-800"
                  >
                    {c.title}
                  </Link>{" "}
                  <span className="text-gray-500">({c.count})</span>
                </li>
              ))}
          </ul>
        </nav>
      )}
      {recent.length > 0 && (
        <section>
          <h2 className={heading}>Recent posts</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {recent.map((p) => (
              <li key={p.slug}>
                <Link href={postPath(p.slug)} className="text-gray-800 no-underline hover:text-orange-800">
                  {p.title}
                </Link>
                <span className="block text-xs text-gray-500">{formatPostDate(p.publishedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {tags.length > 0 && (
        <section>
          <h2 className={heading}>Tags</h2>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {tags.slice(0, 30).map(({ tag, count }) => (
              <li key={tag}>
                <Link
                  href={blogTagPath(tag)}
                  aria-current={current?.tag === tag ? "page" : undefined}
                  className="inline-block rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700 no-underline hover:border-orange-700 hover:text-orange-800 aria-[current=page]:border-orange-700 aria-[current=page]:text-orange-800"
                >
                  {tag} <span className="text-gray-500">({count})</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <a href="/blog/rss.xml" className="text-orange-800">
        RSS feed
      </a>
    </aside>
  );
}
