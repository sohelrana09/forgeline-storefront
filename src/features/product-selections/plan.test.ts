import { describe, expect, it } from "vitest";
import { assignActions, parseSkuList, selectionActions, unassignActions } from "@/features/product-selections/plan";

describe("parseSkuList", () => {
  it("reads one SKU per line or the first CSV column, skipping a header, blanks and duplicates", () => {
    expect(parseSkuList("sku,qty\nair-filter,2\n\noil-filter\nair-filter\nbad sku!\n")).toEqual({
      skus: ["air-filter", "oil-filter"],
      invalid: ["bad sku!"],
    });
  });
});

describe("selectionActions", () => {
  it("adds what is missing and removes what is no longer wanted", () => {
    expect(selectionActions(["a", "b"], ["b", "c"])).toEqual([
      { action: "addProduct", product: { typeId: "product", id: "c" } },
      { action: "removeProduct", product: { typeId: "product", id: "a" } },
    ]);
    expect(selectionActions(["a"], ["a"])).toEqual([]);
  });
});

describe("store assignment", () => {
  const ref = (id: string, active: boolean) => ({ productSelection: { typeId: "product-selection" as const, id }, active });
  it("adds, activates or leaves the selection on the store", () => {
    expect(assignActions([], "k", "s1")).toEqual([
      { action: "addProductSelection", productSelection: { typeId: "product-selection", key: "k" }, active: true },
    ]);
    expect(assignActions([ref("s1", false)], "k", "s1")[0]).toMatchObject({ action: "changeProductSelectionActive", active: true });
    expect(assignActions([ref("s1", true)], "k", "s1")).toEqual([]);
  });
  it("removes it only when it is there", () => {
    expect(unassignActions([ref("s1", true)], "k", "s1")).toHaveLength(1);
    expect(unassignActions([ref("s2", true)], "k", "s1")).toEqual([]);
  });
});
