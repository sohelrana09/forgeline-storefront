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
    // Category placements open the first targeted category through /c/<slug>, which redirects to its path.
    cmsBlock: defineLocations({
      select: { title: "title", placement: "placement", categories: "categories" },
      resolve: (doc) => {
        const placement: string = doc?.placement ?? "";
        const href = placement.startsWith("home.")
          ? "/"
          : placement === "cart.sidebar"
            ? "/cart"
            : doc?.categories?.[0]
              ? `/c/${doc.categories[0]}`
              : undefined;
        return { locations: href ? [{ title: doc?.title ?? "Block", href }] : [] };
      },
    }),
    blogCategory: defineLocations({
      select: { title: "title", slug: "slug.current" },
      resolve: (doc) => ({ locations: doc?.slug ? [{ title: doc.title ?? "Category", href: `/blog/category/${doc.slug}` }] : [] }),
    }),
  },
};
