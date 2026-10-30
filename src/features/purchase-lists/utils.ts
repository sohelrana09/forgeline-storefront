import type { Permission } from "@commercetools/platform-sdk";

// Limits: commercetools allows 250 lines per shopping list; the list count is ours (it has no per-customer limit).
export const MAX_LINES = 250;
export const MAX_LISTS = 50;
export const MAX_QUANTITY = 9999;
// Kept 10 years after the last change (the project default deletes untouched lists after 360 days).
export const KEEP_DAYS = 3650;
export const LIST_NAME = /^[\p{L}\p{M}\p{N}' .,&()/#+-]{1,100}$/u;

// "mine": the customer's personal lists (/me, no business unit). "company": lists in the selected business unit,
// shared with colleagues who may see others' lists (as-associate; see service.ts).
export type ListScope = "mine" | "company";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COMPANY_PREFIX = "company:";

// A list as forms and pickers name it: the id, prefixed for company lists.
export const listRef = (scope: ListScope, id: string) => (scope === "company" ? `${COMPANY_PREFIX}${id}` : id);

export function parseListRef(value: string): { scope: ListScope; id: string } | undefined {
  const scope: ListScope = value.startsWith(COMPANY_PREFIX) ? "company" : "mine";
  const id = scope === "company" ? value.slice(COMPANY_PREFIX.length) : value;
  return UUID.test(id) ? { scope, id } : undefined;
}

export const listHref = (scope: ListScope, id: string) => `/account/purchase-lists/${id}${scope === "company" ? "?scope=company" : ""}`;

// What an associate may do with company lists, from their permissions in the unit. Own lists need the "My"
// permission, colleagues' lists the "Others" one (commercetools checks the same on its side).
export const canSeeCompanyLists = (held: ReadonlySet<Permission>) => held.has("ViewMyShoppingLists") || held.has("ViewOthersShoppingLists");
export const canCreateCompanyList = (held: ReadonlySet<Permission>) => held.has("CreateMyShoppingLists");

// Holding only one of the two view permissions: let commercetools filter, so paging and totals count only the lists
// shown. The actor id comes from the session (a UUID), never from input.
export function companyListWhere(held: ReadonlySet<Permission>, actorId: string): string | undefined {
  const mine = held.has("ViewMyShoppingLists");
  const others = held.has("ViewOthersShoppingLists");
  if (mine && !others) return `customer(id = "${actorId}")`;
  if (others && !mine) return `customer(id != "${actorId}")`;
  return undefined;
}

export type CompanyListRights = { view: boolean; update: boolean; delete: boolean };

export function companyListRights(held: ReadonlySet<Permission>, ownerId: string | undefined, actorId: string): CompanyListRights {
  const own = ownerId === actorId;
  return {
    view: held.has(own ? "ViewMyShoppingLists" : "ViewOthersShoppingLists"),
    update: held.has(own ? "UpdateMyShoppingLists" : "UpdateOthersShoppingLists"),
    delete: held.has(own ? "DeleteMyShoppingLists" : "DeleteOthersShoppingLists"),
  };
}
