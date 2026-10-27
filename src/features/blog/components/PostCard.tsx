import Image from "next/image";
import Link from "next/link";
import { stegaClean } from "next-sanity";
import { imageUrl } from "@/lib/sanity/image";
import type { PostSummary } from "@/features/blog/types";
import { blogCategoryPath, formatPostDate, postPath } from "@/features/blog/utils";

export function PostCard({ post, priority = false }: { post: PostSummary; priority?: boolean }) {
  const href = postPath(stegaClean(post.slug));
  return (
    <article className="flex flex-col overflow-hidden rounded-md border border-gray-200 bg-white">
      {post.coverImage?.asset && (
        <Link href={href} tabIndex={-1} aria-hidden>
          <Image
            src={imageUrl(post.coverImage, 800, 450)}
            alt=""
            width={800}
            height={450}
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
            priority={priority}
            className="aspect-video h-auto w-full object-cover"
          />
        </Link>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="m-0 text-xs text-gray-600">
          <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
          {post.categories.length > 0 && " · "}
          {post.categories.map((c, i) => (
            <span key={c.slug}>
              {i > 0 && ", "}
              <Link href={blogCategoryPath(stegaClean(c.slug))} className="text-gray-600 hover:text-orange-800">
                {c.title}
              </Link>
            </span>
          ))}
        </p>
        <h2 className="m-0 text-lg font-semibold leading-snug">
          <Link href={href} className="text-gray-900 no-underline hover:text-orange-800">
            {post.title}
          </Link>
        </h2>
        {post.excerpt && <p className="m-0 line-clamp-3 text-sm text-gray-700">{post.excerpt}</p>}
        <Link href={href} className="mt-auto pt-2 text-sm font-semibold text-orange-800">
          Read more<span className="sr-only">: {post.title}</span>
        </Link>
      </div>
    </article>
  );
}
