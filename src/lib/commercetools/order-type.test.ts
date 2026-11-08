import { describe, expect, it } from "vitest";
import { ORDER_FIELDS, customFieldActions, missingOrderFields } from "@/lib/commercetools/order-type";

describe("ORDER_FIELDS", () => {
  it("names every field once", () => {
    const names = ORDER_FIELDS.map((f) => f.definition.name);
    expect(new Set(names).size).toBe(names.length);
  });
  it("lists what a Type still lacks", () => {
    expect(missingOrderFields(ORDER_FIELDS.map((f) => f.definition.name))).toEqual([]);
    expect(missingOrderFields(["approvalStatus"]).map((d) => d.name)).not.toContain("approvalStatus");
  });
});

describe("customFieldActions", () => {
  it("sets the Type with the non-empty values on a cart without one", () => {
    expect(customFieldActions(undefined, { a: "1", b: undefined, c: "" })).toEqual([
      { action: "setCustomType", type: { typeId: "type", key: "order-approval" }, fields: { a: "1" } },
    ]);
    expect(customFieldActions(undefined, { a: undefined })).toEqual([]);
  });
  it("changes only differing fields and leaves the others alone", () => {
    expect(customFieldActions({ fields: { a: "1", b: "2", other: "x" } }, { a: "1", b: "", c: "3" })).toEqual([
      { action: "setCustomField", name: "b", value: undefined },
      { action: "setCustomField", name: "c", value: "3" },
    ]);
  });
});
