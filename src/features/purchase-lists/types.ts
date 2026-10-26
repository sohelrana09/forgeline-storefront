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
  name: string;
  description?: string;
  lastModifiedAt: string;
  lines: PurchaseListLine[];
};

export type PurchaseListSummary = Pick<PurchaseList, "id" | "name" | "lastModifiedAt"> & {
  items: number;
  lines: number;
};

export type ListActionState = { error?: string; saved?: string };
