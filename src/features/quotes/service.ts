import "server-only";
import type { Order, Quote, QuoteRequest } from "@commercetools/platform-sdk";
import { apiRoot, customerApiRoot } from "@/lib/commercetools/client";
import { str } from "@/lib/predicate";
import { signOutOnAuthError, type Session } from "@/features/auth/session";
import { hasPermissionNow } from "@/features/business-units/service";
import type { PricingContext } from "@/features/business-units/types";
import { getActiveCart } from "@/features/cart/service";
import { COMMENT_MAX, PO_PATTERN, UUID, canCancelRequest, isActionable } from "@/features/quotes/utils";

// Quotes, server-side. commercetools has no /in-store "me" endpoints for quotes, so reads use the project-wide
// /me/quote-requests and /me/quotes (still only the buyer's own records) and then check business unit and store.

export class QuoteError extends Error {}

const statusOf = (err: unknown) => (err as { body?: { statusCode?: number } })?.body?.statusCode;
const me = (session: Session) => customerApiRoot(session.accessToken).me();

const belongs = (item: { businessUnit?: { key?: string }; store?: { key?: string } }, ctx: PricingContext) =>
  item.businessUnit?.key === ctx.businessUnitKey && (!item.store || item.store.key === ctx.storeKey);

// ---------- Reads ----------

// Same rule as belongs(), in the query itself, so page totals count only this unit's records in this store.
const inScope = (ctx: PricingContext) =>
  `businessUnit(key=${str(ctx.businessUnitKey)}) and (store is not defined or store(key=${str(ctx.storeKey)}))`;

// One page, newest first, with the total for the toolbar; belongs() stays as a second check on every record.
const pageArgs = (ctx: PricingContext, page: number, size: number, extra?: string) => ({
  where: extra ? `${inScope(ctx)} and ${extra}` : inScope(ctx),
  sort: ["createdAt desc"],
  limit: size,
  offset: (Math.max(1, page) - 1) * size,
  withTotal: true,
});

export async function pageMyQuoteRequests(session: Session, ctx: PricingContext, page = 1, size = 10) {
  const { body } = await me(session).quoteRequests().get({ queryArgs: pageArgs(ctx, page, size) }).execute().catch(signOutOnAuthError);
  return { items: body.results.filter((r) => belongs(r, ctx)), total: body.total ?? body.count };
}

export async function pageMyQuotes(session: Session, ctx: PricingContext, page = 1, size = 10, where?: string) {
  const { body } = await me(session).quotes().get({ queryArgs: pageArgs(ctx, page, size, where) }).execute().catch(signOutOnAuthError);
  return { items: body.results.filter((q) => belongs(q, ctx)), total: body.total ?? body.count };
}

// Quotes waiting for the buyer's decision (dashboard notice); expired ones are filtered out with the same rule as the views.
export async function countAwaitingQuotes(session: Session, ctx: PricingContext): Promise<number> {
  const { items } = await pageMyQuotes(session, ctx, 1, 50, `quoteState="Pending"`);
  return items.filter(isActionable).length;
}

export async function getMyQuoteRequest(session: Session, ctx: PricingContext, id: string): Promise<QuoteRequest | undefined> {
  if (!UUID.test(id)) return undefined;
  const request = await me(session)
    .quoteRequests()
    .withId({ ID: id })
    .get()
    .execute()
    .then((r) => r.body)
    .catch((err) => (statusOf(err) === 404 ? undefined : signOutOnAuthError(err)));
  return request && belongs(request, ctx) ? request : undefined;
}

export async function getMyQuote(session: Session, ctx: PricingContext, id: string): Promise<Quote | undefined> {
  if (!UUID.test(id)) return undefined;
  const quote = await me(session)
    .quotes()
    .withId({ ID: id })
    .get()
    .execute()
    .then((r) => r.body)
    .catch((err) => (statusOf(err) === 404 ? undefined : signOutOnAuthError(err)));
  return quote && belongs(quote, ctx) ? quote : undefined;
}

export async function quotesForRequest(session: Session, ctx: PricingContext, requestId: string): Promise<Quote[]> {
  if (!UUID.test(requestId)) return [];
  const { body } = await me(session)
    .quotes()
    .get({ queryArgs: { where: `quoteRequest(id="${requestId}")`, sort: ["createdAt desc"], limit: 20 } })
    .execute()
    .catch(signOutOnAuthError);
  return body.results.filter((q) => belongs(q, ctx));
}

// ---------- Writes ----------

const cleanComment = (comment: string, required: boolean) => {
  const text = comment.trim();
  if (required && !text) throw new QuoteError("Add a comment for the seller.");
  if (text.length > COMMENT_MAX) throw new QuoteError(`Comments can be at most ${COMMENT_MAX} characters.`);
  return text;
};

// From the buyer's own open cart (read with their token first, so a forged cart id can't be used).
export async function createQuoteRequest(
  session: Session,
  ctx: PricingContext,
  cartId: string,
  expectedVersion: number,
  comment: string,
): Promise<QuoteRequest> {
  const text = cleanComment(comment, true);
  const cart = await getActiveCart(session, cartId, ctx);
  if (!cart) throw new QuoteError("Your cart is no longer available. Please reload it.");
  if (cart.lineItems.length === 0) throw new QuoteError("Your cart is empty.");
  if (cart.version !== expectedVersion) throw new QuoteError("Your cart changed. Please review it and request the quote again.");
  const { body } = await me(session)
    .quoteRequests()
    .post({ body: { cartId: cart.id, cartVersion: cart.version, comment: text } })
    .execute()
    .catch(signOutOnAuthError);
  return body;
}

export async function cancelQuoteRequest(session: Session, ctx: PricingContext, id: string): Promise<QuoteRequest> {
  const request = await getMyQuoteRequest(session, ctx, id);
  if (!request) throw new QuoteError("Quote request not found.");
  if (!canCancelRequest(request)) throw new QuoteError("Only submitted requests can be cancelled.");
  const { body } = await me(session)
    .quoteRequests()
    .withId({ ID: request.id })
    .post({ body: { version: request.version, actions: [{ action: "cancelQuoteRequest" }] } })
    .execute()
    .catch(signOutOnAuthError);
  return body;
}

async function actionableQuote(session: Session, ctx: PricingContext, id: string, expectedVersion: number) {
  const quote = await getMyQuote(session, ctx, id);
  if (!quote) throw new QuoteError("Quote not found.");
  // Admin-backed actions run in ctx.storeKey: the quote must belong to exactly that store.
  if (quote.store?.key !== ctx.storeKey) throw new QuoteError("This quote belongs to a different store.");
  if (!isActionable(quote)) throw new QuoteError("This quote can no longer be changed.");
  if (quote.version !== expectedVersion) throw new QuoteError("This quote changed. Please review it again.");
  return quote;
}

export async function declineQuote(session: Session, ctx: PricingContext, id: string, expectedVersion: number): Promise<Quote> {
  const quote = await actionableQuote(session, ctx, id, expectedVersion);
  const { body } = await me(session)
    .quotes()
    .withId({ ID: quote.id })
    .post({ body: { version: quote.version, actions: [{ action: "changeMyQuoteState", quoteState: "Declined" }] } })
    .execute()
    .catch(signOutOnAuthError);
  return body;
}

// There is no "me" action for renegotiation: after the customer-token read (ownership) and a live permission check,
// the admin client makes the change in the quote's store.
export async function renegotiateQuote(
  session: Session,
  ctx: PricingContext,
  id: string,
  expectedVersion: number,
  comment: string,
): Promise<Quote> {
  const text = cleanComment(comment, true);
  const quote = await actionableQuote(session, ctx, id, expectedVersion);
  if (!(await hasPermissionNow(ctx.businessUnitKey, session.customerId, "RenegotiateMyQuotes"))) {
    throw new QuoteError("You don't have permission to renegotiate quotes.");
  }
  const { body } = await apiRoot
    .inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey })
    .quotes()
    .withId({ ID: quote.id })
    .post({ body: { version: quote.version, actions: [{ action: "requestQuoteRenegotiation", buyerComment: text }] } })
    .execute();
  return body;
}

// Accept + order in ONE call (quoteStateToAccepted): ordering requires the quote to still be Pending.
// /me/orders/quotes needs project-wide manage_my_orders, which the narrowed buyer token doesn't carry (always 403),
// so the order is created by the admin client in the quote's store, after: the buyer-token ownership read,
// BU/store/Pending/expiry/version checks (actionableQuote) and a live CreateMyOrdersFromMyQuotes permission check.
export async function orderFromQuote(
  session: Session,
  ctx: PricingContext,
  id: string,
  expectedVersion: number,
  purchaseOrderNumber: string,
): Promise<{ order: Order; poSaved: boolean }> {
  const po = purchaseOrderNumber.trim();
  if (po && !PO_PATTERN.test(po)) throw new QuoteError("PO number: up to 35 letters, digits, spaces or . _ / # -");
  const quote = await actionableQuote(session, ctx, id, expectedVersion);
  if (!(await hasPermissionNow(ctx.businessUnitKey, session.customerId, "CreateMyOrdersFromMyQuotes"))) {
    throw new QuoteError("You don't have permission to order from quotes.");
  }
  const inStore = apiRoot.inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey });
  const { body: order } = await inStore
    .orders()
    .orderQuote()
    .post({ body: { quote: { typeId: "quote", id: quote.id }, version: quote.version, quoteStateToAccepted: true } })
    .execute();
  if (!po) return { order, poSaved: true };

  // Neither order-from-quote draft takes a PO number, so it's a second write. The order already exists at this
  // point: a failure here must not look like "no order was placed".
  const setPo = (version: number) =>
    inStore
      .orders()
      .withId({ ID: order.id })
      .post({ body: { version, actions: [{ action: "setPurchaseOrderNumber", purchaseOrderNumber: po }] } })
      .execute()
      .then((r) => r.body);
  try {
    return { order: await setPo(order.version), poSaved: true };
  } catch (err) {
    try {
      if (statusOf(err) !== 409) throw err;
      const { body: fresh } = await inStore.orders().withId({ ID: order.id }).get().execute();
      return { order: await setPo(fresh.version), poSaved: true };
    } catch (retryErr) {
      console.error(`order ${order.id}: PO number could not be saved`, (retryErr as { body?: unknown })?.body ?? retryErr);
      return { order, poSaved: false };
    }
  }
}
