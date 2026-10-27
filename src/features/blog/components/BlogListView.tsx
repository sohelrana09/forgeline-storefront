import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getPosts } from "@/features/blog/service";
import { POSTS_PER_PAGE, type BlogCategory, type PostFilter } from "@/features/blog/types";
import { BLOG_PATH, listPath } from "@/features/blog/utils";
import { PostCard } from "@/features/blog/components/PostCard";
import { BlogSidebar } from "@/features/blog/components/BlogSidebar";

// The blog list: all posts, one category's or one tag's, newest first, paged.
export async function BlogListView({ filter, page, category }: { filter: PostFilter; page: number; category?: BlogCategory }) {
  const { posts, total } = await getPosts(filter, page);
  const pages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));
  // A page past the end, or a tag nobody uses, is not a page.
  if (page > pages || (filter.tag && total === 0)) notFound();

  const title = category ? category.title : filter.tag ? `Posts tagged “${filter.tag}”` : "Blog";
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs items={filter.category || filter.tag ? [{ label: "Blog", href: BLOG_PATH }, { label: title }] : [{ label: "Blog" }]} />
      <div className="grid gap-8 lg:grid-cols-[1fr_16rem]">
        <div className="flex flex-col gap-4">
          <header>
            <h1 className="m-0 text-3xl font-bold">{title}</h1>
            {category?.description && <p className="mb-0 mt-2 text-gray-700">{category.description}</p>}
          </header>
          {posts.length === 0 ? (
            <p className="text-gray-700">No posts yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {posts.map((p, i) => (
                <PostCard key={p.slug} post={p} priority={page === 1 && i === 0} />
              ))}
            </div>
          )}
          {pages > 1 && (
            <nav aria-label="Pages" className="flex items-center justify-between gap-4 text-sm">
              {page > 1 ? (
                <Link href={listPath(filter, page - 1)} rel="prev" className="font-semibold text-orange-800">
                  ← Newer posts
                </Link>
              ) : (
                <span />
              )}
              <span className="text-gray-600">
                Page {page} of {pages}
              </span>
              {page < pages ? (
                <Link href={listPath(filter, page + 1)} rel="next" className="font-semibold text-orange-800">
                  Older posts →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>
        <BlogSidebar current={filter} />
      </div>
    </div>
  );
}
