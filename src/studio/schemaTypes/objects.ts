import { defineArrayMember, defineField, defineType } from "sanity";
import { BasketIcon } from "@sanity/icons/Basket";
import { ImageIcon } from "@sanity/icons/Image";
import { LinkIcon } from "@sanity/icons/Link";
import { ThLargeIcon } from "@sanity/icons/ThLarge";
import { ProductPickerInput } from "@/studio/components/ProductPickerInput";

// Shared field types: SEO, a commercetools product reference, the rich text body and its product cards.

export const seo = defineType({
  name: "seo",
  title: "SEO",
  type: "object",
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({
      name: "title",
      title: "Meta title",
      type: "string",
      description: "Defaults to the title.",
      validation: (r) => r.max(70),
    }),
    defineField({ name: "description", title: "Meta description", type: "text", rows: 3, validation: (r) => r.max(160) }),
  ],
});

// A product from commercetools, stored by SKU (prices, stock and names always come live from commercetools; the
// name and picture here only label the choice in the Studio).
export const ctProduct = defineType({
  name: "ctProduct",
  title: "Product",
  type: "object",
  icon: BasketIcon,
  components: { input: ProductPickerInput },
  fields: [
    defineField({ name: "sku", title: "SKU", type: "string", validation: (r) => r.required() }),
    defineField({ name: "name", title: "Name", type: "string", readOnly: true }),
    defineField({ name: "image", title: "Picture", type: "url", readOnly: true }),
  ],
  preview: {
    select: { name: "name", sku: "sku", imageUrl: "image" },
    // Items added by the import script have only a SKU.
    prepare: ({ name, sku, imageUrl }) => ({ title: name || sku || "Choose a product", subtitle: name ? sku : undefined, imageUrl }),
  },
});

export const productCards = defineType({
  name: "productCards",
  title: "Product cards",
  type: "object",
  icon: BasketIcon,
  fields: [
    defineField({ name: "title", title: "Heading", type: "string" }),
    defineField({
      name: "products",
      title: "Products",
      type: "array",
      of: [defineArrayMember({ type: "ctProduct" })],
      validation: (r) => r.required().min(1).max(12),
    }),
  ],
  preview: {
    select: { title: "title", products: "products" },
    prepare: ({ title, products }) => ({ title: title || "Product cards", subtitle: `${products?.length ?? 0} products` }),
  },
});

// Links: site paths (/excavators, /blog/…) or https URLs; nothing else (no javascript:, no mailto tricks).
const link = defineArrayMember({
  name: "link",
  title: "Link",
  type: "object",
  icon: LinkIcon,
  fields: [
    defineField({
      name: "href",
      title: "URL",
      type: "string",
      description: "A path on this site (/excavators) or a full https:// address.",
      validation: (r) =>
        r.required().custom((v) => (typeof v === "string" && /^(\/(?![/\\])|https:\/\/)/.test(v) ? true : "Use /path or https://")),
    }),
  ],
});

// Tables (delivery costs, specifications), in the shape @portabletext/markdown produces for Markdown tables:
// table → row → cell, each cell holding plain text blocks.
export const tableCell = defineType({
  name: "cell",
  title: "Cell",
  type: "object",
  fields: [defineField({ name: "value", title: "Text", type: "array", of: [defineArrayMember({ type: "block", styles: [], lists: [] })] })],
  preview: { select: { blocks: "value" }, prepare: ({ blocks }) => ({ title: blocks?.[0]?.children?.[0]?.text || "Empty cell" }) },
});

export const tableRow = defineType({
  name: "row",
  title: "Row",
  type: "object",
  fields: [defineField({ name: "cells", title: "Cells", type: "array", of: [defineArrayMember({ type: "cell" })] })],
  preview: {
    select: { cells: "cells" },
    prepare: ({ cells }) => ({
      title:
        (cells ?? []).map((c: { value?: { children?: { text?: string }[] }[] }) => c.value?.[0]?.children?.[0]?.text ?? "").join(" | ") ||
        "Empty row",
    }),
  },
});

export const table = defineType({
  name: "table",
  title: "Table",
  type: "object",
  icon: ThLargeIcon,
  fields: [
    defineField({
      name: "headerRows",
      title: "Header rows",
      type: "number",
      initialValue: 1,
      validation: (r) => r.min(0).max(3).integer(),
    }),
    defineField({ name: "rows", title: "Rows", type: "array", of: [defineArrayMember({ type: "row" })] }),
  ],
  preview: { select: { rows: "rows" }, prepare: ({ rows }) => ({ title: "Table", subtitle: `${rows?.length ?? 0} rows` }) },
});

export const blockContent = defineType({
  name: "blockContent",
  title: "Content",
  type: "array",
  of: [
    defineArrayMember({
      type: "block",
      styles: [
        { title: "Normal", value: "normal" },
        { title: "Heading 2", value: "h2" },
        { title: "Heading 3", value: "h3" },
        { title: "Heading 4", value: "h4" },
        { title: "Quote", value: "blockquote" },
      ],
      lists: [
        { title: "Bullets", value: "bullet" },
        { title: "Numbers", value: "number" },
      ],
      marks: {
        decorators: [
          { title: "Bold", value: "strong" },
          { title: "Italic", value: "em" },
          { title: "Code", value: "code" },
        ],
        annotations: [link],
      },
    }),
    defineArrayMember({
      type: "image",
      icon: ImageIcon,
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Alternative text",
          type: "string",
          description: "Describes the picture. Leave empty only for decoration.",
        }),
        defineField({ name: "caption", title: "Caption", type: "string" }),
      ],
    }),
    defineArrayMember({ type: "table" }),
    defineArrayMember({ type: "productCards" }),
  ],
});
