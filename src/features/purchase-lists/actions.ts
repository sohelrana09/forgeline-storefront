"use server";

// Public endpoints for purchase lists. Signed-in customers only (business buyers and consumers); every list is read
// and written with the customer's own token, so a forged list id is simply not found. Products are checked against
// the selected unit's store before they go on a list; "add to cart" goes through the quick-order path (re-priced,
// unsold products reported, machines for quote).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { tooManyAttempts } from "@/lib/rate-limit";
import { requireShopContext } from "@/features/business-units/context";
import { getActiveCart, lookupSkus } from "@/features/cart/service";
import { MAX_LINES as CART_BATCH, parseQuickOrder } from "@/features/quick-order/parser";
import { addParsedLines } from "@/features/quick-order/service";
import { UUID } from "@/features/orders/utils";
import { addToList, createList, deleteList, getList, PurchaseListError, renameList, updateLines } from "@/features/purchase-lists/service";
import { LIST_NAME, MAX_QUANTITY } from "@/features/purchase-lists/utils";
import type { ListActionState } from "@/features/purchase-lists/types";
import type { QuickOrderState } from "@/features/quick-order/types";

type Shop = Awaited<ReturnType<typeof requireShopContext>>;
const str = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

async function run(work: (shop: Shop) => Promise<string>): Promise<ListActionState> {
  const shop = await requireShopContext();
  if (await tooManyAttempts(`lists:${shop.session.customerId}`, 120)) return { error: "Too many changes. Please wait a few minutes and try again." };
  try {
    const saved = await work(shop);
    revalidatePath("/(shop)", "layout");
    return { saved };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof PurchaseListError) return { error: err.message };
    console.error("purchase list update failed", (err as { body?: unknown })?.body ?? err);
    return { error: "The purchase list could not be saved. Please try again." };
  }
}

const checkName = (name: string) => {
  if (!LIST_NAME.test(name)) throw new PurchaseListError("Give the list a name of up to 100 letters, digits and simple punctuation.");
  return name;
};

// Lines that exist in the selected unit's store; the rest are reported back.
async function knownLines(shop: Shop, lines: { sku: string; quantity: number }[]) {
  const found = await lookupSkus(shop.context, lines.map((l) => l.sku));
  const known = lines.filter((l) => found.has(l.sku));
  const unknown = lines.filter((l) => !found.has(l.sku)).map((l) => l.sku);
  if (known.length === 0) throw new PurchaseListError(unknown.length ? `Unknown SKU for ${shop.context.storeName}: ${unknown.join(", ")}` : "Nothing to add.");
  return { known, unknown };
}

// The target list: an existing one (by id) or a new one with the given name.
async function addTo(shop: Shop, formData: FormData, lines: { sku: string; quantity: number }[]) {
  const { known, unknown } = await knownLines(shop, lines);
  const listId = str(formData, "listId");
  let name: string;
  if (listId === "new" || !listId) {
    name = checkName(str(formData, "newName"));
    await createList(shop.session, shop.context, name, known);
  } else {
    if (!UUID.test(listId)) throw new PurchaseListError("Choose a purchase list.");
    const list = await getList(shop.session, shop.context, listId);
    if (!list) throw new PurchaseListError("This purchase list no longer exists.");
    name = list.name;
    await addToList(shop.session, shop.context, listId, known);
  }
  const count = known.length === 1 ? "1 product" : `${known.length} products`;
  return `Added ${count} to "${name}".${unknown.length ? ` Not found: ${unknown.join(", ")}.` : ""}`;
}

export async function createListAction(_prev: ListActionState, formData: FormData): Promise<ListActionState> {
  let id = "";
  const result = await run(async (shop) => {
    id = await createList(shop.session, shop.context, checkName(str(formData, "name")));
    return "List created.";
  });
  if (result.error) return result;
  redirect(`/account/purchase-lists/${id}`);
}

// Product page: one SKU and quantity.
export async function addProductToListAction(_prev: ListActionState, formData: FormData): Promise<ListActionState> {
  const sku = str(formData, "sku");
  const quantity = Number(formData.get("quantity"));
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(sku)) return { error: "Unknown product." };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) return { error: `Enter a quantity from 1 to ${MAX_QUANTITY}.` };
  return run((shop) => addTo(shop, formData, [{ sku, quantity }]));
}

// Cart page: every line of the current cart.
export async function saveCartToListAction(_prev: ListActionState, formData: FormData): Promise<ListActionState> {
  return run(async (shop) => {
    const cart = await getActiveCart(shop.session, shop.cartId, shop.context);
    const lines = (cart?.lineItems ?? []).flatMap((l) => (l.variant.sku ? [{ sku: l.variant.sku, quantity: l.quantity }] : []));
    if (lines.length === 0) throw new PurchaseListError("Your cart is empty.");
    return addTo(shop, formData, lines);
  });
}

// Quick order: the pasted "SKU, quantity" lines; lines that don't parse are reported.
export async function addQuickOrderToListAction(_prev: ListActionState, formData: FormData): Promise<ListActionState> {
  const { lines, errors } = parseQuickOrder(str(formData, "lines"));
  if (lines.length === 0) return { error: errors.length ? `Check these lines: ${errors.map((e) => e.text).join("; ")}` : "Enter at least one SKU." };
  const result = await run((shop) => addTo(shop, formData, lines));
  return result.saved && errors.length ? { saved: `${result.saved} Skipped: ${errors.map((e) => e.text).join("; ")}.` } : result;
}

export async function renameListAction(_prev: ListActionState, formData: FormData): Promise<ListActionState> {
  const id = str(formData, "listId");
  if (!UUID.test(id)) return { error: "Unknown list." };
  return run(async (shop) => {
    await renameList(shop.session, shop.context, id, checkName(str(formData, "name")));
    return "List renamed.";
  });
}

// List page: new quantities (qty-<lineId>) and removals (remove = <lineId>, repeated).
export async function updateListAction(_prev: ListActionState, formData: FormData): Promise<ListActionState> {
  const id = str(formData, "listId");
  if (!UUID.test(id)) return { error: "Unknown list." };
  const removed = new Set(formData.getAll("remove").map(String));
  const changes: { lineId: string; quantity: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("qty-")) continue;
    const lineId = key.slice(4);
    const quantity = Number(value);
    if (!UUID.test(lineId)) continue;
    if (removed.has(lineId)) changes.push({ lineId, quantity: 0 });
    else if (Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY) changes.push({ lineId, quantity });
    else return { error: `Enter quantities from 1 to ${MAX_QUANTITY}.` };
  }
  return run(async (shop) => {
    await updateLines(shop.session, shop.context, id, changes);
    return removed.size > 0 ? "List updated; removed products are gone." : "List updated.";
  });
}

export async function deleteListAction(_prev: ListActionState, formData: FormData): Promise<ListActionState> {
  const id = str(formData, "listId");
  if (!UUID.test(id)) return { error: "Unknown list." };
  const result = await run(async (shop) => {
    await deleteList(shop.session, shop.context, id);
    return "List deleted.";
  });
  if (result.error) return result;
  redirect("/account/purchase-lists?deleted=1");
}

// Selected lines (or all, "scope=all") into the cart at the selected unit's prices.
// A cart takes at most CART_BATCH products per add (the quick-order limit); the rest are reported.
export async function addListToCartAction(_prev: QuickOrderState, formData: FormData): Promise<QuickOrderState> {
  const fail = (reason: string): QuickOrderState => ({ added: [], errors: [{ line: 0, text: "", reason }] });
  const shop = await requireShopContext();
  if (await tooManyAttempts(`lists:cart:${shop.session.customerId}`, 60)) return fail("Too many attempts. Please wait a few minutes and try again.");
  const id = str(formData, "listId");
  try {
    const list = UUID.test(id) ? await getList(shop.session, shop.context, id) : undefined;
    if (!list) return fail("This purchase list no longer exists.");
    const selected = new Set(formData.getAll("line").map(String));
    const all = formData.get("scope") === "all";
    const lines = list.lines.filter((l) => l.available && l.sku && (all || selected.has(l.id)));
    if (lines.length === 0) return fail(all ? "No products on this list can be ordered." : "Tick the products to add.");
    const result = await addParsedLines(lines.slice(0, CART_BATCH).map((l) => `${l.sku}, ${l.quantity}`).join("\n"));
    const rest = lines.length - CART_BATCH;
    return {
      ...result,
      submitted: undefined,
      errors: rest > 0 ? [...result.errors, { line: 0, text: "", reason: `Only the first ${CART_BATCH} products were added. Tick the other ${rest} and use Add selected.` }] : result.errors,
    };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error("purchase list to cart failed", (err as { body?: unknown })?.body ?? err);
    return fail("The list could not be added to your cart. Please try again.");
  }
}
