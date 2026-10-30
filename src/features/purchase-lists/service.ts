import "server-only";
import type { LocalizedString, ShoppingList, ShoppingListPagedQueryResponse } from "@commercetools/platform-sdk";
import { apiRoot, asAssociate, customerApiRoot } from "@/lib/commercetools/client";
import { localize } from "@/features/catalog/utils";
import { signOutOnAuthError, type Session } from "@/features/auth/session";
import { permissionsNow } from "@/features/business-units/service";
import type { BuyerContext, PricingContext } from "@/features/business-units/types";
import { UUID } from "@/features/orders/utils";
import {
  MAX_QUANTITY,
  KEEP_DAYS,
  MAX_LINES,
  MAX_LISTS,
  canCreateCompanyList,
  canSeeCompanyLists,
  companyListRights,
  companyListWhere,
  listRef,
  type ListScope,
} from "@/features/purchase-lists/utils";
import type { PurchaseList, PurchaseListSummary } from "@/features/purchase-lists/types";

// Purchase lists are commercetools Shopping Lists, in two scopes:
// - "mine" (personal): the customer's own lists in the selected unit's store, read and written with their narrowed
//   token (manage_my_shopping_lists:<project>:<store>): commercetools only finds lists of that customer in that store,
//   so a foreign id is simply not found.
// - "company": lists in the selected business unit, shared between its associates. They exist only under
//   as-associate/{id}/in-business-unit/key={unit}, so the admin client acts for the signed-in associate (id from the
//   session only) after a live check of their shopping-list permissions: View/Update/DeleteMy for their own lists,
//   ...Others for colleagues'. commercetools checks the same permissions on its side. Consumers have no company lists.
// Stored lines carry no SKU or price: reads expand the variant for its SKU; prices come from the catalog per unit.

export class PurchaseListError extends Error {}

type Line = { sku: string; quantity: number };
type ListAction =
  | { action: "addLineItem"; sku: string; quantity: number }
  | { action: "changeName"; name: LocalizedString }
  | { action: "changeLineItemQuantity"; lineItemId: string; quantity: number };
type QueryArgs = { sort?: string[]; limit?: number; offset?: number; withTotal?: boolean; where?: string };
type Draft = { name: LocalizedString; deleteDaysAfterLastModification: number; lineItems: Line[] };

const EXPAND = ["lineItems[*].variant"];
const statusOf = (err: unknown) => (err as { body?: { statusCode?: number } })?.body?.statusCode;

// The same few calls on either endpoint.
type ListsApi = {
  query: (args: QueryArgs) => Promise<ShoppingListPagedQueryResponse>;
  create: (draft: Draft) => Promise<ShoppingList>;
  read: (id: string) => Promise<ShoppingList>;
  update: (id: string, version: number, actions: ListAction[]) => Promise<ShoppingList>;
  remove: (id: string, version: number) => Promise<unknown>;
  // Errors: the customer token signs out on 401 or a missing scope; as-associate refusals become a message.
  fail: (err: unknown) => never;
};

// /me returns every list the customer owns, company lists included (they carry the customer too): personal lists are
// the ones without a business unit, so company lists never show up, or can be changed, as personal ones here.
const PERSONAL = "businessUnit is not defined";
const NOT_FOUND = { body: { statusCode: 404, message: "Not a personal list" } };

function myLists(session: Session, ctx: PricingContext): ListsApi {
  const b = () => customerApiRoot(session.accessToken).inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey }).me().shoppingLists();
  return {
    query: ({ where, ...args }) =>
      b()
        .get({ queryArgs: { ...args, where: where ? `${PERSONAL} and (${where})` : PERSONAL } })
        .execute()
        .then((r) => r.body),
    create: (draft) =>
      b()
        .post({ body: draft })
        .execute()
        .then((r) => r.body),
    read: (id) =>
      b()
        .withId({ ID: id })
        .get({ queryArgs: { expand: EXPAND } })
        .execute()
        .then((r) => (r.body.businessUnit ? Promise.reject(NOT_FOUND) : r.body)),
    update: (id, version, actions) =>
      b()
        .withId({ ID: id })
        .post({ body: { version, actions } })
        .execute()
        .then((r) => r.body),
    remove: (id, version) => b().withId({ ID: id }).delete({ queryArgs: { version } }).execute(),
    fail: signOutOnAuthError,
  };
}

function companyLists(session: Session, ctx: PricingContext): ListsApi {
  const b = () => asAssociate(session.customerId, ctx.businessUnitKey).shoppingLists();
  return {
    query: (args) =>
      b()
        .get({ queryArgs: args })
        .execute()
        .then((r) => r.body),
    create: (draft) =>
      b()
        .post({
          body: {
            ...draft,
            customer: { typeId: "customer", id: session.customerId },
            store: { typeId: "store", key: ctx.storeKey },
          },
        })
        .execute()
        .then((r) => r.body),
    read: (id) =>
      b()
        .withId({ ID: id })
        .get({ queryArgs: { expand: EXPAND } })
        .execute()
        .then((r) => r.body),
    update: (id, version, actions) =>
      b()
        .withId({ ID: id })
        .post({ body: { version, actions } })
        .execute()
        .then((r) => r.body),
    remove: (id, version) => b().withId({ ID: id }).delete({ queryArgs: { version } }).execute(),
    // commercetools refuses a missing associate permission with 400 AssociateMissingPermission (checked live).
    fail: (err) => {
      const body = (err as { body?: { statusCode?: number; errors?: { code?: string }[] } })?.body;
      if (body?.statusCode === 403 || body?.errors?.some((e) => e.code === "AssociateMissingPermission")) {
        throw new PurchaseListError("You don't have permission to do this with company lists.");
      }
      throw err;
    },
  };
}

// The endpoint for a scope, plus the associate's live permissions for company lists. A consumer (no unit) or an
// associate without any view permission gets no company lists at all.
async function access(session: Session, ctx: PricingContext, scope: ListScope) {
  if (scope === "mine") return { api: myLists(session, ctx), held: undefined };
  if (!ctx.businessUnitKey) throw new PurchaseListError("Company lists need a company account.");
  const held = await permissionsNow(ctx.businessUnitKey, session.customerId);
  if (!canSeeCompanyLists(held)) throw new PurchaseListError("You don't have permission to see company lists.");
  return { api: companyLists(session, ctx), held };
}

type Access = Awaited<ReturnType<typeof access>>;
const rightsFor = (a: Access, list: Pick<ShoppingList, "customer">, actorId: string) =>
  a.held ? companyListRights(a.held, list.customer?.id, actorId) : { view: true, update: true, delete: true };

// Whether the signed-in customer can use company lists in the selected unit (live; false for consumers).
export async function companyListsAllowed(session: Session, ctx: PricingContext): Promise<{ view: boolean; create: boolean }> {
  if (!ctx.businessUnitKey) return { view: false, create: false };
  const held = await permissionsNow(ctx.businessUnitKey, session.customerId);
  return { view: canSeeCompanyLists(held), create: canCreateCompanyList(held) };
}

// "First Last" by customer id, for "made by" on company lists.
async function customerNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter((id) => UUID.test(id));
  if (unique.length === 0) return new Map();
  const { body } = await apiRoot
    .customers()
    .get({ queryArgs: { where: `id in (${unique.map((id) => `"${id}"`).join(", ")})`, limit: unique.length } })
    .execute();
  return new Map(body.results.map((c) => [c.id, [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email]));
}

function toList(list: ShoppingList, scope: ListScope, rights: { update: boolean; delete: boolean }, owner?: string): PurchaseList {
  return {
    id: list.id,
    version: list.version,
    scope,
    name: localize(list.name),
    description: list.description ? localize(list.description) : undefined,
    lastModifiedAt: list.lastModifiedAt,
    owner,
    canUpdate: rights.update,
    canDelete: rights.delete,
    lines: list.lineItems.map((l) => ({
      id: l.id,
      sku: l.variant?.sku,
      name: localize(l.name),
      quantity: l.quantity,
      available: !l.deactivatedAt && l.variant !== undefined,
    })),
  };
}

export async function pageLists(session: Session, ctx: PricingContext, page: number, size: number, scope: ListScope = "mine") {
  const a = await access(session, ctx, scope);
  const body = await a.api
    .query({
      sort: ["lastModifiedAt desc"],
      limit: size,
      offset: (page - 1) * size,
      withTotal: true,
      ...(a.held && { where: companyListWhere(a.held, session.customerId) }),
    })
    .catch(a.api.fail);
  const visible = body.results.filter((l) => rightsFor(a, l, session.customerId).view);
  const names = scope === "company" ? await customerNames(visible.flatMap((l) => (l.customer ? [l.customer.id] : []))) : undefined;
  const lists: PurchaseListSummary[] = visible.map((l) => ({
    id: l.id,
    name: localize(l.name),
    lastModifiedAt: l.lastModifiedAt,
    owner: l.customer && names?.get(l.customer.id),
    lines: l.lineItems.length,
    items: l.lineItems.reduce((n, li) => n + li.quantity, 0),
  }));
  return { lists, total: body.total ?? body.count };
}

// Names and picker values, for "Add to purchase list" (newest first): the personal lists, then the company lists the
// associate may change (their value carries the scope, see listRef). Display only, so it trusts the unit's
// permissions in the buying context (memoized, up to 5 minutes old) and reads both kinds of list at once; adding to a
// list checks the permissions live (access), and commercetools enforces them on the as-associate endpoint too.
export async function listNames(session: Session, ctx: BuyerContext): Promise<{ id: string; name: string }[]> {
  const held = new Set(ctx.permissions);
  const mine = myLists(session, ctx);
  const company = ctx.businessUnitKey && canSeeCompanyLists(held) ? companyLists(session, ctx) : undefined;
  const [own, shared] = await Promise.all([
    mine.query({ sort: ["lastModifiedAt desc"], limit: MAX_LISTS }).catch(mine.fail),
    // Best effort: the picker still offers the personal lists if the company ones can't be read.
    company?.query({ sort: ["lastModifiedAt desc"], limit: MAX_LISTS }).catch((err) => {
      console.error("company lists failed", (err as { body?: unknown })?.body ?? err);
      return undefined;
    }),
  ]);
  return [
    ...own.results.map((l) => ({ id: listRef("mine", l.id), name: localize(l.name) })),
    ...(shared?.results ?? [])
      .filter((l) => companyListRights(held, l.customer?.id, session.customerId).update)
      .map((l) => ({ id: listRef("company", l.id), name: `${localize(l.name)} (company)` })),
  ];
}

async function read(a: Access, id: string): Promise<ShoppingList | undefined> {
  if (!UUID.test(id)) return undefined;
  return a.api.read(id).catch((err) => (statusOf(err) === 404 ? undefined : a.api.fail(err)));
}

export async function getList(
  session: Session,
  ctx: PricingContext,
  id: string,
  scope: ListScope = "mine",
): Promise<PurchaseList | undefined> {
  const a = await access(session, ctx, scope);
  const list = await read(a, id);
  if (!list) return undefined;
  const rights = rightsFor(a, list, session.customerId);
  if (!rights.view) return undefined;
  const owner = scope === "company" && list.customer ? (await customerNames([list.customer.id])).get(list.customer.id) : undefined;
  return toList(list, scope, rights, owner);
}

export async function createList(
  session: Session,
  ctx: PricingContext,
  name: string,
  lines: Line[] = [],
  scope: ListScope = "mine",
): Promise<string> {
  const a = await access(session, ctx, scope);
  if (a.held && !canCreateCompanyList(a.held)) throw new PurchaseListError("You don't have permission to create company lists.");
  const existing = await a.api.query({ limit: 1, withTotal: true }).catch(a.api.fail);
  if ((existing.total ?? 0) >= MAX_LISTS)
    throw new PurchaseListError(
      scope === "company"
        ? `A company keeps up to ${MAX_LISTS} shared lists. Delete one it no longer needs.`
        : `You can keep up to ${MAX_LISTS} purchase lists. Delete one you no longer need.`,
    );
  const merged = mergeLines(lines);
  if (merged.length > MAX_LINES) throw new PurchaseListError(`A purchase list holds up to ${MAX_LINES} products.`);
  const body = await a.api
    .create({
      name: { "en-GB": name },
      deleteDaysAfterLastModification: KEEP_DAYS,
      lineItems: merged.map((l) => ({ sku: l.sku, quantity: l.quantity })),
    })
    .catch(a.api.fail);
  return body.id;
}

// Same SKU twice → one line with the quantities added up.
function mergeLines(lines: Line[]): Line[] {
  const bySku = new Map<string, number>();
  for (const l of lines) bySku.set(l.sku, (bySku.get(l.sku) ?? 0) + l.quantity);
  return [...bySku].map(([sku, quantity]) => ({ sku, quantity }));
}

// Applies actions built from the CURRENT list; on a version conflict re-reads it and rebuilds once.
// Company lists: the associate needs UpdateMy (own list) or UpdateOthers (a colleague's), checked live each time.
async function update(session: Session, ctx: PricingContext, scope: ListScope, id: string, actions: (list: ShoppingList) => ListAction[]) {
  const a = await access(session, ctx, scope);
  for (let attempt = 1; ; attempt++) {
    const list = await read(a, id);
    const rights = list && rightsFor(a, list, session.customerId);
    if (!list || !rights?.view) throw new PurchaseListError("This purchase list no longer exists.");
    if (!rights.update) throw new PurchaseListError("You can't change this company list.");
    const body = actions(list);
    if (body.length === 0) return list;
    try {
      return await a.api.update(id, list.version, body);
    } catch (err) {
      if (statusOf(err) !== 409 || attempt === 2) return a.api.fail(err);
    }
  }
}

// Adds products; a product already on the list gets the quantity added (commercetools merges the same variant).
export async function addToList(session: Session, ctx: PricingContext, id: string, lines: Line[], scope: ListScope = "mine") {
  await update(session, ctx, scope, id, (list) => {
    const merged = mergeLines(lines);
    const onList = new Map(list.lineItems.flatMap((l) => (l.variant?.sku ? [[l.variant.sku, l.quantity] as const] : [])));
    if (list.lineItems.length + merged.filter((l) => !onList.has(l.sku)).length > MAX_LINES) {
      throw new PurchaseListError(`A purchase list holds up to ${MAX_LINES} products.`);
    }
    const tooMany = merged.find((l) => (onList.get(l.sku) ?? 0) + l.quantity > MAX_QUANTITY);
    if (tooMany) throw new PurchaseListError(`${tooMany.sku} would go over ${MAX_QUANTITY} on this list.`);
    return merged.map((l) => ({ action: "addLineItem" as const, sku: l.sku, quantity: l.quantity }));
  });
}

export async function renameList(session: Session, ctx: PricingContext, id: string, name: string, scope: ListScope = "mine") {
  await update(session, ctx, scope, id, (list) =>
    localize(list.name) === name ? [] : [{ action: "changeName", name: { "en-GB": name } }],
  );
}

// New quantities by line id; 0 removes the line. Lines no longer on the list are ignored.
export async function updateLines(
  session: Session,
  ctx: PricingContext,
  id: string,
  changes: { lineId: string; quantity: number }[],
  scope: ListScope = "mine",
) {
  await update(session, ctx, scope, id, (list) =>
    changes
      .filter((c) => list.lineItems.some((l) => l.id === c.lineId && l.quantity !== c.quantity))
      .map((c) => ({ action: "changeLineItemQuantity" as const, lineItemId: c.lineId, quantity: c.quantity })),
  );
}

// Company lists: DeleteMy (own list) or DeleteOthers (a colleague's), checked live.
export async function deleteList(session: Session, ctx: PricingContext, id: string, scope: ListScope = "mine") {
  const a = await access(session, ctx, scope);
  for (let attempt = 1; ; attempt++) {
    const list = await read(a, id);
    if (!list || !rightsFor(a, list, session.customerId).view) return;
    if (!rightsFor(a, list, session.customerId).delete) throw new PurchaseListError("You can't delete this company list.");
    try {
      await a.api.remove(id, list.version);
      return;
    } catch (err) {
      if (statusOf(err) !== 409 || attempt === 2) return a.api.fail(err);
    }
  }
}
