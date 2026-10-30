import { describe, expect, it } from "vitest";
import type { Permission } from "@commercetools/platform-sdk";
import {
  canCreateCompanyList,
  canSeeCompanyLists,
  companyListRights,
  companyListWhere,
  listHref,
  listRef,
  parseListRef,
} from "@/features/purchase-lists/utils";

const ID = "0b9d2c3e-1f4a-4b5c-8d6e-7f8091a2b3c4";
const held = (...p: Permission[]) => new Set<Permission>(p);

describe("list references", () => {
  it("round-trips personal and company ids", () => {
    expect(parseListRef(listRef("mine", ID))).toEqual({ scope: "mine", id: ID });
    expect(parseListRef(listRef("company", ID))).toEqual({ scope: "company", id: ID });
  });

  it("refuses anything that isn't a list id", () => {
    expect(parseListRef("new")).toBeUndefined();
    expect(parseListRef("company:")).toBeUndefined();
    expect(parseListRef(`other:${ID}`)).toBeUndefined();
  });

  it("links company lists with their scope", () => {
    expect(listHref("mine", ID)).toBe(`/account/purchase-lists/${ID}`);
    expect(listHref("company", ID)).toBe(`/account/purchase-lists/${ID}?scope=company`);
  });
});

describe("company list rights", () => {
  it("needs a view permission to see company lists at all", () => {
    expect(canSeeCompanyLists(held())).toBe(false);
    expect(canSeeCompanyLists(held("ViewMyShoppingLists"))).toBe(true);
    expect(canSeeCompanyLists(held("ViewOthersShoppingLists"))).toBe(true);
    expect(canCreateCompanyList(held("ViewMyShoppingLists"))).toBe(false);
    expect(canCreateCompanyList(held("CreateMyShoppingLists"))).toBe(true);
  });

  it("uses the My permissions for own lists", () => {
    const buyer = held("ViewMyShoppingLists", "UpdateMyShoppingLists", "ViewOthersShoppingLists");
    expect(companyListRights(buyer, "me", "me")).toEqual({ view: true, update: true, delete: false });
  });

  it("uses the Others permissions for a colleague's list", () => {
    const buyer = held("ViewMyShoppingLists", "UpdateMyShoppingLists", "DeleteMyShoppingLists", "ViewOthersShoppingLists");
    expect(companyListRights(buyer, "colleague", "me")).toEqual({ view: true, update: false, delete: false });
    const admin = held("ViewOthersShoppingLists", "UpdateOthersShoppingLists", "DeleteOthersShoppingLists");
    expect(companyListRights(admin, "colleague", "me")).toEqual({ view: true, update: true, delete: true });
  });

  it("treats a list without an owner as someone else's", () =>
    expect(companyListRights(held("ViewMyShoppingLists", "UpdateMyShoppingLists"), undefined, "me")).toEqual({
      view: false,
      update: false,
      delete: false,
    }));
});

describe("companyListWhere", () => {
  const set = (...p: Permission[]) => new Set<Permission>(p);
  it("narrows to own or others' lists when only one view permission is held", () => {
    expect(companyListWhere(set("ViewMyShoppingLists"), "me")).toBe('customer(id = "me")');
    expect(companyListWhere(set("ViewOthersShoppingLists"), "me")).toBe('customer(id != "me")');
    expect(companyListWhere(set("ViewMyShoppingLists", "ViewOthersShoppingLists"), "me")).toBeUndefined();
  });
});
