import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { stegaClean } from "next-sanity";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/ui/JsonLd";
import { imageUrl } from "@/lib/sanity/image";
import { siteUrl } from "@/lib/site-url";
import { breadcrumbJsonLd } from "@/features/catalog/seo";
import { ProductCards, RichText } from "@/features/cms/components/RichText";
import type { BuyerContext } from "@/features/business-units/types";
import { getPost } from "@/features/blog/service";
import { postJsonLd } from "@/features/blog/seo";
import { BLOG_PATH, blogCategoryPath, blogTagPath, formatPostDate, postPath } from "@/features/blog/utils";
import { BlogSidebar } from "@/features/blog/components/BlogSidebar";

export async function BlogPostView({ slug, context }: { slug: string; context: BuyerContext }) {
  const post = await getPost(slug);
  if (!post) notFound();
  const category = post.categories[0];
  return (
    <div className="flex flex-col gap-4">
      <JsonLd data={postJsonLd(post)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Blog", url: `${siteUrl()}${BLOG_PATH}` },
          { name: stegaClean(post.title), url: `${siteUrl()}${postPath(stegaClean(post.slug))}` },
        ])}
      />
      <Breadcrumbs
        items={[
          { label: "Blog", href: BLOG_PATH },
          ...(category ? [{ label: category.title, href: blogCategoryPath(stegaClean(category.slug)) }] : []),
          { label: post.title },
        ]}
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_16rem]">
        <article className="min-w-0 rounded-md border border-gray-200 bg-white p-6">
          <header className="mb-6 flex flex-col gap-2">
            <h1 className="m-0 text-3xl font-bold leading-tight">{post.title}</h1>
            <p className="m-0 text-sm text-gray-600">
              <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
              {post.author && <> · {post.author.name}</>}
            </p>
            {post.excerpt && <p className="m-0 text-lg text-gray-700">{post.excerpt}</p>}
          </header>
          {post.coverImage?.asset && (
            <Image
              src={imageUrl(post.coverImage, 1400, 788)}
              alt={stegaClean(post.coverImage.alt) ?? ""}
              width={1400}
              height={788}
              sizes="(min-width: 1024px) 760px, 100vw"
              priority
              className="mb-6 h-auto w-full rounded"
            />
          )}
          <RichText value={post.body} context={context} />
          <ProductCards title="Products in this post" products={post.products} context={context} />
          {post.tags.length > 0 && (
            <ul className="mb-0 mt-6 flex list-none flex-wrap gap-2 p-0" aria-label="Tags">
              {post.tags.map((t) => (
                <li key={t}>
                  <Link
                    href={blogTagPath(stegaClean(t))}
                    className="inline-block rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 no-underline hover:border-orange-700 hover:text-orange-800"
                  >
                    {t}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {post.author?.name && (
            <footer className="mt-8 flex items-center gap-3 border-t border-gray-200 pt-4">
              {post.author.image?.asset && (
                <Image src={imageUrl(post.author.image, 96, 96)} alt="" width={48} height={48} className="rounded-full" />
              )}
              <p className="m-0 text-sm">
                <span className="font-semibold">{post.author.name}</span>
                {post.author.role && <span className="block text-gray-600">{post.author.role}</span>}
              </p>
            </footer>
          )}
        </article>
        <BlogSidebar />
      </div>
    </div>
  );
}
