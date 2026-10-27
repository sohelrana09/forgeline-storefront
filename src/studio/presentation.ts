import { defineDocuments, defineLocations, type PresentationPluginOptions } from "sanity/presentation";

// Where each document shows on the storefront, for the Presentation tool (preview pane and "Used on" list).
export const resolve: PresentationPluginOptions["resolve"] = {
  mainDocuments: defineDocuments([
    { route: "/blog/:slug", filter: `_type == "post" && slug.current == $slug` },
    { route: "/blog/category/:slug", filter: `_type == "blogCategory" && slug.current == $slug` },
    { route: "/:slug", filter: `_type == "page" && slug.current == $slug` },
  ]),
  locations: {
    page: defineLocations({
      select: { title: "title", slug: "slug.current" },
      resolve: (doc) => ({ locations: doc?.slug ? [{ title: doc.title ?? "Page", href: `/${doc.slug}` }] : [] }),
    }),
    post: defineLocations({
      select: { title: "title", slug: "slug.current" },
      resolve: (doc) => ({
        locations: [...(doc?.slug ? [{ title: doc.title ?? "Post", href: `/blog/${doc.slug}` }] : []), { title: "Blog", href: "/blog" }],
      }),
    }),
    blogCategory: defineLocations({
      select: { title: "title", slug: "slug.current" },
      resolve: (doc) => ({ locations: doc?.slug ? [{ title: doc.title ?? "Category", href: `/blog/category/${doc.slug}` }] : [] }),
    }),
  },
};
