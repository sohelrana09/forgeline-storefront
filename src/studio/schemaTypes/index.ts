import { author, blogCategory, page, post } from "@/studio/schemaTypes/documents";
import { blockContent, ctProduct, productCards, seo, table, tableCell, tableRow } from "@/studio/schemaTypes/objects";

export const schemaTypes = [page, post, author, blogCategory, blockContent, table, tableRow, tableCell, productCards, ctProduct, seo];
