import { dateLocale } from "@/lib/i18n";
import "server-only";
import type { Cart, CartUpdateAction, Order, RecurringOrder } from "@commercetools/platform-sdk";
import { apiRoot, customerApiRoot } from "@/lib/commercetools/client";
import { statusOf } from "@/lib/commercetools/errors";
import { str } from "@/lib/predicate";
import { staleWhileRevalidate } from "@/lib/memo";
import { sendMail, siteUrl } from "@/lib/mailer";
import { reportEvent } from "@/lib/error-report";
import { formatMoney } from "@/lib/utils";
import { signOutOnAuthError, type Session } from "@/features/auth/session";
import { getCustomerContexts, hasPermissionNow } from "@/features/business-units/service";
import type { BuyerContext, PricingContext } from "@/features/business-units/types";
import { cartAddress } from "@/features/cart/service";
import { getMyOrder } from "@/features/orders/service";
import { orderReference } from "@/features/orders/utils";
import { getList } from "@/features/purchase-lists/service";
import type { ListScope } from "@/features/purchase-lists/utils";
import { procurementActions, readProcurement } from "@/features/checkout/procurement";
import { checkOrderBudget } from "@/features/spending-limits/service";
import { cartShortfalls } from "@/features/checkout/service";
import { localize } from "@/features/catalog/utils";
import {
  REMINDER_CONTAINER,
  allowedOps,
  opAction,
  policyOptions,
  recurringLines,
  reminderDue,
  reminderKey,
  scheduleLabel,
  type RecurringOp,
} from "@/features/recurring-orders/schedule";

// Recurring orders on native commercetools Recurring Orders (docs/features/recurring-orders.md).
// - The recurring cart is created with the BUYER's token (/in-store/me/carts), so commercetools checks that they are an
//   associate allowed to create carts in the unit; its lines carry recurrenceInfo with priceSelectionMode Dynamic, so
//   every run is priced at that day's prices.
// - Recurring Orders have no /me or in-store endpoint: the admin client creates and changes them, only after the
//   customer token created the cart (or read the source order/list) and a live CreateMyOrdersFromMyCarts check, and it
//   only touches recurring orders whose customer and business unit are the session's.
// - commercetools creates each order on schedule. The daily cron (/api/cron/recurring-orders) emails a reminder
//   before each run and checks budget and stock then; a run that would fail is paused and the buyer told.

export class RecurringOrderError extends Error {}

const policiesMemo = staleWhileRevalidate<{ key: string; label: string }[]>(10 * 60_000);

export const recurrencePolicies = () =>
  policiesMemo("all", async () => {
    const { body } = await apiRoot
      .recurrencePolicies()
      .get({ queryArgs: { limit: 50 } })
      .execute();
    return policyOptions(body.results);
  });

async function mayOrderNow(ctx: PricingContext, customerId: string) {
  if (!(await hasPermissionNow(ctx.businessUnitKey, customerId, "CreateMyOrdersFromMyCarts"))) {
    throw new RecurringOrderError("Only buyers who may place orders can set up recurring orders.");
  }
}

type Source = { kind: "order"; id: string } | { kind: "list"; id: string; scope: ListScope };

// The lines (and, for an order, its addresses, delivery method and procurement fields) to repeat. Read with the
// buyer's own access: their order through their token, a list through the purchase-list rules.
async function readSource(session: Session, ctx: PricingContext, source: Source) {
  if (source.kind === "order") {
    const order = await getMyOrder(session, ctx, source.id);
    if (!order || order.businessUnit?.key !== ctx.businessUnitKey) throw new RecurringOrderError("That order was not found.");
    return {
      label: `order ${orderReference(order)}`,
      lines: recurringLines(order.lineItems.map((l) => ({ sku: l.variant.sku, quantity: l.quantity }))),
      order,
    };
  }
  const list = await getList(session, ctx, source.id, source.scope);
  if (!list) throw new RecurringOrderError("That purchase list was not found.");
  return { label: `list ${list.name}`, lines: recurringLines(list.lines), order: undefined as Order | undefined };
}

export async function createRecurringOrder(session: Session, ctx: BuyerContext, source: Source, policyKey: string, startsAt: string) {
  const [policies] = await Promise.all([recurrencePolicies(), mayOrderNow(ctx, session.customerId)]);
  if (!policies.some((p) => p.key === policyKey)) throw new RecurringOrderError("Choose how often to order.");
  const { lines, order, label } = await readSource(session, ctx, source);
  if (lines.length === 0) throw new RecurringOrderError("There is nothing to repeat: none of its products can be ordered now.");

  const recurrenceInfo = {
    recurrencePolicy: { typeId: "recurrence-policy" as const, key: policyKey },
    priceSelectionMode: "Dynamic" as const,
  };
  const shipping = order?.shippingAddress ?? ctx.defaultShippingAddress;
  // The buyer's own cart in the unit (their token): commercetools refuses a unit they aren't an associate of.
  const { body: cart } = await customerApiRoot(session.accessToken)
    .inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey })
    .me()
    .carts()
    .post({
      body: {
        currency: ctx.currency,
        ...(ctx.country && { country: ctx.country }),
        ...(ctx.supplyChannelId && { inventoryMode: "ReserveOnOrder" as const }),
        businessUnit: { typeId: "business-unit", key: ctx.businessUnitKey },
        shippingAddress: cartAddress(shipping),
        billingAddress: cartAddress(order?.billingAddress ?? ctx.defaultBillingAddress),
        ...(order?.shippingInfo?.shippingMethod && {
          shippingMethod: { typeId: "shipping-method" as const, id: order.shippingInfo.shippingMethod.id },
        }),
        ...(order?.customerEmail && { customerEmail: order.customerEmail }),
        lineItems: lines.map((l) => ({
          ...l,
          distributionChannel: { typeId: "channel" as const, id: ctx.channelId },
          ...(ctx.supplyChannelId && { supplyChannel: { typeId: "channel" as const, id: ctx.supplyChannelId } }),
          recurrenceInfo,
        })),
      },
    })
    .execute()
    .catch(signOutOnAuthError);

  try {
    // Procurement fields carry over from the source order (a fixed delivery date doesn't repeat), set like the PO
    // number at checkout: admin client, on the cart the customer token just created.
    let blueprint: Cart = cart;
    const procurement = { ...readProcurement(order?.custom), requestedDeliveryDate: undefined };
    const actions: CartUpdateAction[] = [
      ...(order?.purchaseOrderNumber
        ? [{ action: "setPurchaseOrderNumber" as const, purchaseOrderNumber: order.purchaseOrderNumber }]
        : []),
      ...procurementActions(undefined, procurement),
    ];
    if (actions.length > 0) {
      blueprint = (
        await apiRoot
          .inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey })
          .carts()
          .withId({ ID: cart.id })
          .post({ body: { version: cart.version, actions } })
          .execute()
      ).body;
    }
    const { body } = await apiRoot
      .recurringOrders()
      .post({ body: { cart: { typeId: "cart", id: blueprint.id }, cartVersion: blueprint.version, startsAt } })
      .execute();
    return { recurringOrder: body, label };
  } catch (err) {
    // No orphan cart left behind to show up as the buyer's open cart.
    await apiRoot
      .inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey })
      .carts()
      .withId({ ID: cart.id })
      .delete({ queryArgs: { version: cart.version } })
      .execute()
      .catch(() => undefined);
    throw err;
  }
}

export type RecurringSummary = {
  id: string;
  state: string;
  schedule: string;
  nextOrderAt?: string;
  lastOrderAt?: string;
  startsAt: string;
  skips: number;
  lines: { sku: string; name: string; quantity: number }[];
  total?: string;
  ops: RecurringOp[];
};

const summarize = (r: RecurringOrder, cart?: Cart): RecurringSummary => ({
  id: r.id,
  state: r.recurringOrderState,
  schedule: scheduleLabel(r.schedule),
  nextOrderAt: r.nextOrderAt,
  lastOrderAt: r.lastOrderAt,
  startsAt: r.startsAt,
  skips: r.skipConfiguration ? Math.max(r.skipConfiguration.totalToSkip - r.skipConfiguration.skipped, 0) : 0,
  lines: (cart?.lineItems ?? []).map((l) => ({ sku: l.variant.sku ?? "", name: localize(l.name), quantity: l.quantity })),
  total: cart && formatMoney(cart.totalPrice),
  ops: allowedOps(r.recurringOrderState),
});

const mineWhere = (customerId: string, unitKey: string) => `customer(id=${str(customerId)}) and businessUnit(key=${str(unitKey)})`;

// The buyer's own recurring orders in the selected unit, newest first, with their carts (lines and today's total).
export async function listMyRecurringOrders(session: Session, ctx: PricingContext): Promise<RecurringSummary[]> {
  const { body } = await apiRoot
    .recurringOrders()
    .get({
      queryArgs: {
        where: mineWhere(session.customerId, ctx.businessUnitKey),
        sort: ["createdAt desc"],
        limit: 50,
        expand: ["cart"],
      },
    })
    .execute();
  return body.results.map((r) => summarize(r, r.cart.obj));
}

// One of the buyer's own recurring orders, or nothing (someone else's, another unit's, unknown id).
async function readMine(session: Session, ctx: PricingContext, id: string): Promise<RecurringOrder | undefined> {
  const r = await apiRoot
    .recurringOrders()
    .withId({ ID: id })
    .get()
    .execute()
    .then((res) => res.body)
    .catch((err) => (statusOf(err) === 404 ? undefined : Promise.reject(err)));
  return r && r.customer?.id === session.customerId && r.businessUnit?.key === ctx.businessUnitKey ? r : undefined;
}

export async function changeRecurringOrder(session: Session, ctx: PricingContext, id: string, op: RecurringOp) {
  // Pausing or cancelling is always the buyer's right; resuming and skipping keep ordering, so they need the
  // permission to order (checked live).
  if (op === "resume" || op === "skip") await mayOrderNow(ctx, session.customerId);
  for (let attempt = 1; ; attempt++) {
    const r = await readMine(session, ctx, id);
    if (!r) throw new RecurringOrderError("That recurring order was not found.");
    if (!allowedOps(r.recurringOrderState).includes(op)) throw new RecurringOrderError("That isn't possible for this recurring order now.");
    try {
      await apiRoot
        .recurringOrders()
        .withId({ ID: id })
        .post({ body: { version: r.version, actions: [opAction(op, r)] } })
        .execute();
      return;
    } catch (err) {
      if (statusOf(err) !== 409 || attempt === 2) throw err;
    }
  }
}

// ---------- Daily cron: reminders and the pre-run check ----------

// Marks the reminder as sent; false when it was already (a second cron run in the same window sends nothing).
async function claimReminder(key: string): Promise<boolean> {
  try {
    await apiRoot
      .customObjects()
      .post({ body: { container: REMINDER_CONTAINER, key, value: { at: new Date().toISOString() }, version: 0 } })
      .execute();
    return true;
  } catch (err) {
    if (statusOf(err) === 409) return false;
    throw err;
  }
}

async function pause(r: RecurringOrder) {
  await apiRoot
    .recurringOrders()
    .withId({ ID: r.id })
    .post({ body: { version: r.version, actions: [opAction("pause", r)] } })
    .execute();
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(dateLocale(), { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

// For every active recurring order due in the next 48 hours: re-check the buyer's budget and stock at today's prices,
// pause it with an explanation when the run would be refused, else send the reminder. Idempotent per run.
export async function sweepRecurringOrders(now = new Date()) {
  const until = new Date(now.getTime() + 48 * 3_600_000).toISOString();
  const { body } = await apiRoot
    .recurringOrders()
    .get({
      queryArgs: {
        where: `recurringOrderState = "Active" and nextOrderAt <= ${str(until)} and nextOrderAt > ${str(now.toISOString())}`,
        limit: 200,
        expand: ["cart"],
      },
    })
    .execute();
  const result = { due: 0, reminded: 0, paused: 0, failed: 0 };
  for (const r of body.results.filter((r) => reminderDue(r, now))) {
    result.due++;
    try {
      if (!(await claimReminder(reminderKey(r)))) continue;
      const cart = r.cart.obj;
      const customerId = r.customer?.id;
      const email = cart?.customerEmail ?? r.customerEmail;
      if (!cart || !customerId) continue;
      const ctx = (await getCustomerContexts(customerId)).contexts.find((c) => c.businessUnitKey === r.businessUnit?.key);
      const problem = !ctx
        ? "you are no longer a buyer of this company"
        : !ctx.canOrder
          ? "your role no longer allows placing orders"
          : await preRunProblem(ctx, customerId, cart);
      if (problem) {
        await pause(r);
        result.paused++;
      } else result.reminded++;
      if (!email) continue;
      const link = `${siteUrl()}/account/recurring-orders`;
      await sendMail({
        to: email,
        subject: problem ? "Your recurring order is paused" : `Your recurring order runs on ${day(r.nextOrderAt!)}`,
        text: problem
          ? `Your recurring order (${scheduleLabel(r.schedule).toLowerCase()}) was due on ${day(r.nextOrderAt!)}, but ${problem}. We paused it so nothing is ordered by mistake. Resume it when this is solved: ${link}`
          : `Your recurring order (${scheduleLabel(r.schedule).toLowerCase()}) places an order on ${day(r.nextOrderAt!)} at that day's prices, currently ${formatMoney(cart.totalPrice)}:\n\n${cart.lineItems
              .map((l) => `${l.quantity} x ${localize(l.name)} (${l.variant.sku ?? ""})`)
              .join("\n")}\n\nTo skip this order, pause or cancel: ${link}`,
      });
    } catch (err) {
      result.failed++;
      reportEvent("recurring_reminder_failed", err, { recurringOrderId: r.id });
    }
  }
  return result;
}

// Why the next run would be refused, in words for the buyer, or nothing. Budget at today's prices (block mode only)
// and stock in the store's supply channel. Approval rules apply to the order itself (commercetools).
async function preRunProblem(ctx: PricingContext, customerId: string, cart: Cart): Promise<string | undefined> {
  const repriced = await apiRoot
    .inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey })
    .carts()
    .withId({ ID: cart.id })
    .post({ body: { version: cart.version, actions: [{ action: "recalculate", updateProductData: false }] } })
    .execute()
    .then((r) => r.body);
  const budget = await checkOrderBudget(ctx, customerId, repriced.taxedPrice?.totalNet ?? repriced.totalPrice);
  if (budget.decision === "block") return "it would exceed your spending budget";
  const short = await cartShortfalls(repriced);
  if (short.length > 0) return `${short.join(", ")} ${short.length === 1 ? "is" : "are"} out of stock`;
  return undefined;
}
