import "server-only";
import type { MyShoppingListUpdateAction, ShoppingList } from "@commercetools/platform-sdk";
import { customerApiRoot } from "@/lib/commercetools/client";
import { localize } from "@/features/catalog/utils";
import { signOutOnAuthError, type Session } from "@/features/auth/session";
import type { PricingContext } from "@/features/business-units/types";
import { UUID } from "@/features/orders/utils";
import { MAX_QUANTITY, KEEP_DAYS, MAX_LINES, MAX_LISTS } from "@/features/purchase-lists/utils";
import type { PurchaseList, PurchaseListSummary } from "@/features/purchase-lists/types";

// Purchase lists (Magento "Requisition lists") are the customer's own commercetools Shopping Lists in the selected
// unit's store, read and written with their narrowed token (manage_my_shopping_lists:<project>:<store>):
// commercetools only finds lists of that customer in that store, so a foreign id is simply not found.
// Stored lines carry no SKU or price: reads expand the variant for its SKU; prices come from the catalog per unit.

export class PurchaseListError extends Error {}

type Line = { sku: string; quantity: number };

const myLists = (session: Session, ctx: PricingContext) =>
  customerApiRoot(session.accessToken).inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey }).me().shoppingLists();
const EXPAND = ["lineItems[*].variant"];
const statusOf = (err: unknown) => (err as { body?: { statusCode?: number } })?.body?.statusCode;

function toList(list: ShoppingList): PurchaseList {
  return {
    id: list.id,
    version: list.version,
    name: localize(list.name),
    description: list.description ? localize(list.description) : undefined,
    lastModifiedAt: list.lastModifiedAt,
    lines: list.lineItems.map((l) => ({
      id: l.id,
      sku: l.variant?.sku,
      name: localize(l.name),
      quantity: l.quantity,
      available: !l.deactivatedAt && l.variant !== undefined,
    })),
  };
}

export async function pageLists(session: Session, ctx: PricingContext, page: number, size: number) {
  const { body } = await myLists(session, ctx)
    .get({ queryArgs: { sort: ["lastModifiedAt desc"], limit: size, offset: (page - 1) * size, withTotal: true } })
    .execute()
    .catch(signOutOnAuthError);
  const lists: PurchaseListSummary[] = body.results.map((l) => ({
    id: l.id,
    name: localize(l.name),
    lastModifiedAt: l.lastModifiedAt,
    lines: l.lineItems.length,
    items: l.lineItems.reduce((n, li) => n + li.quantity, 0),
  }));
  return { lists, total: body.total ?? body.count };
}

// Names and ids only, for "Add to purchase list" pickers (newest first).
export async function listNames(session: Session, ctx: PricingContext): Promise<{ id: string; name: string }[]> {
  const { body } = await myLists(session, ctx)
    .get({ queryArgs: { sort: ["lastModifiedAt desc"], limit: MAX_LISTS } })
    .execute()
    .catch(signOutOnAuthError);
  return body.results.map((l) => ({ id: l.id, name: localize(l.name) }));
}

async function read(session: Session, ctx: PricingContext, id: string): Promise<ShoppingList | undefined> {
  if (!UUID.test(id)) return undefined;
  return myLists(session, ctx)
    .withId({ ID: id })
    .get({ queryArgs: { expand: EXPAND } })
    .execute()
    .then((r) => r.body)
    .catch((err) => (statusOf(err) === 404 ? undefined : signOutOnAuthError(err)));
}

export async function getList(session: Session, ctx: PricingContext, id: string): Promise<PurchaseList | undefined> {
  const list = await read(session, ctx, id);
  return list && toList(list);
}

export async function createList(session: Session, ctx: PricingContext, name: string, lines: Line[] = []): Promise<string> {
  const { body: existing } = await myLists(session, ctx).get({ queryArgs: { limit: 1, withTotal: true } }).execute().catch(signOutOnAuthError);
  if ((existing.total ?? 0) >= MAX_LISTS) throw new PurchaseListError(`You can keep up to ${MAX_LISTS} purchase lists. Delete one you no longer need.`);
  const merged = mergeLines(lines);
  if (merged.length > MAX_LINES) throw new PurchaseListError(`A purchase list holds up to ${MAX_LINES} products.`);
  const { body } = await myLists(session, ctx)
    .post({
      body: {
        name: { "en-GB": name },
        deleteDaysAfterLastModification: KEEP_DAYS,
        lineItems: merged.map((l) => ({ sku: l.sku, quantity: l.quantity })),
      },
    })
    .execute()
    .catch(signOutOnAuthError);
  return body.id;
}

// Same SKU twice → one line with the quantities added up.
function mergeLines(lines: Line[]): Line[] {
  const bySku = new Map<string, number>();
  for (const l of lines) bySku.set(l.sku, (bySku.get(l.sku) ?? 0) + l.quantity);
  return [...bySku].map(([sku, quantity]) => ({ sku, quantity }));
}

// Applies actions built from the CURRENT list; on a version conflict re-reads it and rebuilds once.
async function update(session: Session, ctx: PricingContext, id: string, actions: (list: ShoppingList) => MyShoppingListUpdateAction[]) {
  for (let attempt = 1; ; attempt++) {
    const list = await read(session, ctx, id);
    if (!list) throw new PurchaseListError("This purchase list no longer exists.");
    const body = actions(list);
    if (body.length === 0) return list;
    try {
      return (await myLists(session, ctx).withId({ ID: id }).post({ body: { version: list.version, actions: body } }).execute()).body;
    } catch (err) {
      if (statusOf(err) !== 409 || attempt === 2) return signOutOnAuthError(err);
    }
  }
}

// Adds products; a product already on the list gets the quantity added (commercetools merges the same variant).
export async function addToList(session: Session, ctx: PricingContext, id: string, lines: Line[]) {
  await update(session, ctx, id, (list) => {
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

export async function renameList(session: Session, ctx: PricingContext, id: string, name: string) {
  await update(session, ctx, id, (list) => (localize(list.name) === name ? [] : [{ action: "changeName", name: { "en-GB": name } }]));
}

// New quantities by line id; 0 removes the line. Lines no longer on the list are ignored.
export async function updateLines(session: Session, ctx: PricingContext, id: string, changes: { lineId: string; quantity: number }[]) {
  await update(session, ctx, id, (list) =>
    changes
      .filter((c) => list.lineItems.some((l) => l.id === c.lineId && l.quantity !== c.quantity))
      .map((c) => ({ action: "changeLineItemQuantity" as const, lineItemId: c.lineId, quantity: c.quantity })),
  );
}

export async function deleteList(session: Session, ctx: PricingContext, id: string) {
  for (let attempt = 1; ; attempt++) {
    const list = await read(session, ctx, id);
    if (!list) return;
    try {
      await myLists(session, ctx).withId({ ID: id }).delete({ queryArgs: { version: list.version } }).execute();
      return;
    } catch (err) {
      if (statusOf(err) !== 409 || attempt === 2) return signOutOnAuthError(err);
    }
  }
}
