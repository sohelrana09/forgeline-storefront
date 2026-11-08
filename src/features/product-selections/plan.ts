import type { ProductSelectionUpdateAction, ProductSelectionSetting, StoreUpdateAction } from "@commercetools/platform-sdk";

// Company assortments (docs/features/product-selections.md), pure and unit-tested. A commercetools Product Selection
// assigned to a store limits what that store's units see: every catalog read already passes storeProjection
// (features/catalog/pricing.ts), so the storefront follows the selection without code of its own. These helpers plan
// the changes `npm run ct:product-selections` makes.

const SKU = /^[A-Za-z0-9._-]{1,64}$/;

// One SKU per line, or the first column of a CSV (a header row "sku" is skipped).
export function parseSkuList(text: string): { skus: string[]; invalid: string[] } {
  const skus: string[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const value = raw
      .split(/[,;\t]/)[0]
      .replace(/^"|"$/g, "")
      .trim();
    if (!value || /^sku$/i.test(value)) continue;
    if (!SKU.test(value)) invalid.push(value);
    else if (!skus.includes(value)) skus.push(value);
  }
  return { skus, invalid };
}

// The update that makes the selection hold exactly `desired` (product ids).
export function selectionActions(current: string[], desired: string[]): ProductSelectionUpdateAction[] {
  const have = new Set(current);
  const want = new Set(desired);
  return [
    ...[...want]
      .filter((id) => !have.has(id))
      .map((id): ProductSelectionUpdateAction => ({ action: "addProduct", product: { typeId: "product", id } })),
    ...[...have]
      .filter((id) => !want.has(id))
      .map((id): ProductSelectionUpdateAction => ({ action: "removeProduct", product: { typeId: "product", id } })),
  ];
}

// Assign the selection to a store (active), or switch it on when it is there but inactive. Other selections stay.
export function assignActions(
  store: ProductSelectionSetting[] | undefined,
  selectionKey: string,
  selectionId: string,
): StoreUpdateAction[] {
  const existing = (store ?? []).find((s) => s.productSelection.id === selectionId);
  if (!existing)
    return [{ action: "addProductSelection", productSelection: { typeId: "product-selection", key: selectionKey }, active: true }];
  return existing.active
    ? []
    : [{ action: "changeProductSelectionActive", productSelection: { typeId: "product-selection", key: selectionKey }, active: true }];
}

export function unassignActions(
  store: ProductSelectionSetting[] | undefined,
  selectionKey: string,
  selectionId: string,
): StoreUpdateAction[] {
  return (store ?? []).some((s) => s.productSelection.id === selectionId)
    ? [{ action: "removeProductSelection", productSelection: { typeId: "product-selection", key: selectionKey } }]
    : [];
}
