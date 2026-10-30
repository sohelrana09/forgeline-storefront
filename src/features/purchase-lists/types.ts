import type { ListScope } from "@/features/purchase-lists/utils";

export type PurchaseListLine = {
  id: string;
  sku?: string;
  name: string;
  quantity: number;
  // False when the product or variant was unpublished or deleted after it was added.
  available: boolean;
};

export type PurchaseList = {
  id: string;
  version: number;
  scope: ListScope;
  name: string;
  description?: string;
  lastModifiedAt: string;
  lines: PurchaseListLine[];
  // Company lists: who made it, and what the signed-in associate may do with it. Personal lists: all true.
  owner?: string;
  canUpdate: boolean;
  canDelete: boolean;
};

export type PurchaseListSummary = Pick<PurchaseList, "id" | "name" | "lastModifiedAt" | "owner"> & {
  items: number;
  lines: number;
};

export type ListActionState = { error?: string; saved?: string };
