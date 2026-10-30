import { defineArrayMember, defineField, defineType } from "sanity";
import { DocumentTextIcon } from "@sanity/icons/DocumentText";
import { ComposeIcon } from "@sanity/icons/Compose";
import { TagIcon } from "@sanity/icons/Tag";
import { UserIcon } from "@sanity/icons/User";
import { BlockElementIcon } from "@sanity/icons/BlockElement";
import { PLACEMENT_LABELS, PLACEMENTS } from "@/features/cms/types";
import { CategoryPickerInput } from "@/studio/components/CategoryPickerInput";

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

// The storefront's stores (commercetools keys).
const STORES = [
  { title: "Default (consumers and guests)", value: "default-store" },
  { title: "Germany, France and United Kingdom", value: "de-fr-uk" },
  { title: "Spain", value: "spain" },
  { title: "US Medium Customers", value: "us-medium-customers" },
  { title: "US Large Customers", value: "us-large-customers" },
];

const onlyFor =
  (kind: string) =>
  ({ parent }: { parent?: { kind?: string } }) =>
    parent?.kind !== kind;

// A banner, notice or product carousel at a fixed place in the shop.
export const cmsBlock = defineType({
  name: "cmsBlock",
  title: "Block",
  type: "document",
  icon: BlockElementIcon,
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "targeting", title: "Where and when" },
  ],
  fields: [
    defineField({ name: "title", title: "Title", type: "string", group: "content", validation: (r) => r.required() }),
    defineField({
      name: "identifier",
      title: "Identifier",
      type: "slug",
      group: "content",
      description: "A stable name for this block, such as home-delivery-notice.",
      options: { source: "title", maxLength: 96 },
      validation: (r) =>
        r
          .required()
          .custom((v) => (v?.current && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.current) ? true : "Lowercase letters, digits and hyphens")),
    }),
    defineField({
      name: "kind",
      title: "Type",
      type: "string",
      group: "content",
      initialValue: "text",
      options: {
        layout: "radio",
        direction: "horizontal",
        list: [
          { title: "Text", value: "text" },
          { title: "Products", value: "products" },
          { title: "Banner", value: "banner" },
        ],
      },
      validation: (r) => r.required(),
    }),
    defineField({ name: "body", title: "Text", type: "blockContent", group: "content", hidden: onlyFor("text") }),
    defineField({
      name: "style",
      title: "Look",
      type: "string",
      group: "content",
      hidden: onlyFor("text"),
      initialValue: "plain",
      options: {
        layout: "radio",
        direction: "horizontal",
        list: [
          { title: "Plain", value: "plain" },
          { title: "Information (blue)", value: "info" },
          { title: "Promotion (orange)", value: "promo" },
        ],
      },
    }),
    defineField({
      name: "products",
      title: "Products",
      type: "array",
      group: "content",
      hidden: onlyFor("products"),
      description: "Shown as a carousel with each visitor's own price.",
      of: [defineArrayMember({ type: "ctProduct" })],
      validation: (r) => r.max(24),
    }),
    defineField({ name: "headline", title: "Headline", type: "string", group: "content", hidden: onlyFor("banner") }),
    defineField({ name: "text", title: "Text", type: "text", rows: 3, group: "content", hidden: onlyFor("banner") }),
    defineField({
      name: "image",
      title: "Picture",
      type: "image",
      group: "content",
      hidden: onlyFor("banner"),
      description: "16:9 or wider.",
      options: { hotspot: true },
      fields: [defineField({ name: "alt", title: "Alternative text", type: "string", description: "Leave empty only for decoration." })],
    }),
    defineField({
      name: "mobileImage",
      title: "Picture on phones",
      type: "image",
      group: "content",
      hidden: onlyFor("banner"),
      options: { hotspot: true },
    }),
    defineField({
      name: "theme",
      title: "Text colour",
      type: "string",
      group: "content",
      hidden: onlyFor("banner"),
      initialValue: "dark",
      options: {
        layout: "radio",
        direction: "horizontal",
        list: [
          { title: "White text (dark picture)", value: "dark" },
          { title: "Dark text (light picture)", value: "light" },
        ],
      },
    }),
    defineField({ name: "cta", title: "Button", type: "ctaLink", group: "content" }),
    defineField({ name: "secondaryCta", title: "Second button", type: "ctaLink", group: "content", hidden: onlyFor("banner") }),
    defineField({ name: "active", title: "Active", type: "boolean", group: "targeting", initialValue: true }),
    defineField({
      name: "placement",
      title: "Placement",
      type: "string",
      group: "targeting",
      options: { list: PLACEMENTS.map((value) => ({ title: PLACEMENT_LABELS[value], value })) },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "sortOrder",
      title: "Order",
      type: "number",
      group: "targeting",
      description: "Lower numbers show first when several blocks share a placement.",
    }),
    defineField({
      name: "stores",
      title: "Only in these stores",
      type: "array",
      group: "targeting",
      description: "Empty: every store.",
      of: [defineArrayMember({ type: "string" })],
      options: { list: STORES },
    }),
    defineField({
      name: "categories",
      title: "Only on these categories",
      type: "array",
      group: "targeting",
      description: "Empty: every category. A category includes everything below it.",
      of: [defineArrayMember({ type: "string" })],
      components: { input: CategoryPickerInput },
    }),
    defineField({ name: "startsAt", title: "Show from", type: "datetime", group: "targeting" }),
    defineField({
      name: "endsAt",
      title: "Show until",
      type: "datetime",
      group: "targeting",
      validation: (r) =>
        r.custom((end, ctx) => {
          const start = (ctx.parent as { startsAt?: string } | undefined)?.startsAt;
          return !end || !start || Date.parse(end as string) > Date.parse(start) ? true : "Must be after Show from";
        }),
    }),
  ],
  orderings: [
    {
      title: "Placement",
      name: "placement",
      by: [
        { field: "placement", direction: "asc" },
        { field: "sortOrder", direction: "asc" },
      ],
    },
  ],
  preview: {
    select: { title: "title", placement: "placement", active: "active", media: "image" },
    prepare: ({ title, placement, active, media }) => ({
      title,
      subtitle: `${PLACEMENT_LABELS[placement as keyof typeof PLACEMENT_LABELS] ?? placement ?? "No placement"}${active === false ? " · inactive" : ""}`,
      media,
    }),
  },
});
