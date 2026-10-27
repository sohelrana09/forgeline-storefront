import { defineArrayMember, defineField, defineType } from "sanity";
import { DocumentTextIcon } from "@sanity/icons/DocumentText";
import { ComposeIcon } from "@sanity/icons/Compose";
import { TagIcon } from "@sanity/icons/Tag";
import { UserIcon } from "@sanity/icons/User";

// URL keys: lowercase letters, digits and hyphens (the storefront's URL rules, src/lib/urls.ts).
const slugField = (source: string) =>
  defineField({
    name: "slug",
    title: "URL key",
    type: "slug",
    options: {
      source,
      maxLength: 96,
      slugify: (s: string) =>
        s
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
    },
    validation: (r) =>
      r
        .required()
        .custom((v) => (v?.current && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.current) ? true : "Lowercase letters, digits and hyphens")),
  });

// A content page at /<url key> The URL must not clash with a category or product: the
// storefront reports clashes in `npm run ct:urls` and the category or product keeps the address.
export const page = defineType({
  name: "page",
  title: "Page",
  type: "document",
  icon: DocumentTextIcon,
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (r) => r.required() }),
    slugField("title"),
    defineField({ name: "body", title: "Content", type: "blockContent" }),
    defineField({ name: "seo", title: "SEO", type: "seo" }),
  ],
  preview: { select: { title: "title", slug: "slug.current" }, prepare: ({ title, slug }) => ({ title, subtitle: `/${slug ?? ""}` }) },
});

export const post = defineType({
  name: "post",
  title: "Blog post",
  type: "document",
  icon: ComposeIcon,
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (r) => r.required() }),
    slugField("title"),
    defineField({
      name: "publishedAt",
      title: "Publish date",
      type: "datetime",
      description: "The post shows from this time on (later dates schedule it).",
      initialValue: () => new Date().toISOString(),
      validation: (r) => r.required(),
    }),
    defineField({
      name: "excerpt",
      title: "Excerpt",
      type: "text",
      rows: 3,
      description: "Shown in lists and feeds.",
      validation: (r) => r.max(300),
    }),
    defineField({
      name: "coverImage",
      title: "Cover image",
      type: "image",
      options: { hotspot: true },
      fields: [defineField({ name: "alt", title: "Alternative text", type: "string" })],
    }),
    defineField({ name: "author", title: "Author", type: "reference", to: [{ type: "author" }] }),
    defineField({
      name: "categories",
      title: "Categories",
      type: "array",
      of: [defineArrayMember({ type: "reference", to: [{ type: "blogCategory" }] })],
    }),
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      options: { layout: "tags" },
      validation: (r) =>
        r.custom((tags?: string[]) => (tags ?? []).every((t) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(t)) || "Tags: lowercase-with-hyphens"),
    }),
    defineField({ name: "body", title: "Content", type: "blockContent" }),
    defineField({
      name: "products",
      title: "Related products",
      type: "array",
      description: "Shown under the post with each visitor's own price.",
      of: [defineArrayMember({ type: "ctProduct" })],
      validation: (r) => r.max(12),
    }),
    defineField({ name: "seo", title: "SEO", type: "seo" }),
  ],
  orderings: [{ title: "Newest first", name: "publishedAtDesc", by: [{ field: "publishedAt", direction: "desc" }] }],
  preview: {
    select: { title: "title", date: "publishedAt", media: "coverImage" },
    prepare: ({ title, date, media }) => ({ title, subtitle: date ? new Date(date).toLocaleDateString("en-GB") : "No date", media }),
  },
});

export const author = defineType({
  name: "author",
  title: "Author",
  type: "document",
  icon: UserIcon,
  fields: [
    defineField({ name: "name", title: "Name", type: "string", validation: (r) => r.required() }),
    defineField({ name: "role", title: "Role", type: "string" }),
    defineField({ name: "image", title: "Photo", type: "image", options: { hotspot: true } }),
    defineField({ name: "bio", title: "Short bio", type: "text", rows: 3 }),
  ],
  preview: { select: { title: "name", subtitle: "role", media: "image" } },
});

export const blogCategory = defineType({
  name: "blogCategory",
  title: "Blog category",
  type: "document",
  icon: TagIcon,
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (r) => r.required() }),
    slugField("title"),
    defineField({ name: "description", title: "Description", type: "text", rows: 2 }),
  ],
});
