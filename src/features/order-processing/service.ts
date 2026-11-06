import "server-only";
import type { CustomObject, Order } from "@commercetools/platform-sdk";
import { apiRoot } from "@/lib/commercetools/client";
import { sendMail, siteUrl } from "@/lib/mailer";
import { orderDocument } from "@/features/orders/documents";
import { confirmationEmail } from "@/features/order-processing/email";
import {
  counterKey,
  counterNext,
  formatOrderNumber,
  ORDER_NUMBER_CONTAINER,
  orderNumberPrefix,
} from "@/features/order-processing/order-number";
import {
  MARKER_CONTAINER,
  parseMarker,
  pendingSteps,
  releaseStep,
  stepDecision,
  withStep,
  type Marker,
} from "@/features/order-processing/steps";
import {
  cancelledPaymentActions,
  linkPaymentActions,
  paymentDraft,
  paymentKey,
  paymentKind,
  pendingPaymentKind,
  type PaymentKind,
} from "@/features/order-processing/payment";

// After-order processing (G1, G4): one idempotent entry point, processOrder(orderId), for every way an order is
// created (invoice + PO, bank transfer, card through commercetools Checkout, order from quote). It is called from the
// server action right after the order exists, from /api/order-events (a commercetools Subscription, so it also runs
// when the browser never comes back after a card payment), and from the sweep (/api/cron/order-sweep) for anything
// both missed. Each step runs at most once per order, guarded by the order's own version (the number) or the marker's.
//
// Uses the admin client on an order id that came from our own order creation, an authenticated Subscription event
// or our own query: it never takes an id from a visitor.

type StepRun = (order: Order) => Promise<void>;

// The steps after numbering, in order. Each runs even when an earlier one failed (the email doesn't wait for the
// Payment). A step must be safe to retry after
// a crash (it may run again once its claim expires).
const STEPS: { name: string; run: StepRun }[] = [
  { name: "payment", run: ensurePayment },
  { name: "confirmation", run: sendConfirmation },
];
export const STEP_NAMES = STEPS.map((s) => s.name);

const errorOf = (err: unknown) =>
  (err as { body?: { statusCode?: number; errors?: { code?: string }[] } })?.body ?? { statusCode: undefined, errors: undefined };
const statusOf = (err: unknown) => errorOf(err).statusCode;
const hasCode = (err: unknown, code: string) => Boolean(errorOf(err).errors?.some((e) => e.code === code));

const readOrder = (id: string) =>
  apiRoot
    .orders()
    .withId({ ID: id })
    .get()
    .execute()
    .then((r) => r.body);

const readObject = (container: string, key: string) =>
  apiRoot
    .customObjects()
    .withContainerAndKey({ container, key })
    .get()
    .execute()
    .then((r) => r.body)
    .catch((err): undefined => {
      if (statusOf(err) === 404) return undefined;
      throw err;
    });

// Writes a Custom Object; with `version` only if it is still at that version (409 otherwise).
const writeObject = (container: string, key: string, value: unknown, version?: number) =>
  apiRoot
    .customObjects()
    .post({ body: { container, key, value, ...(version === undefined ? {} : { version }) } })
    .execute()
    .then((r) => r.body);

// ---------- G4: order numbers ----------

// Takes the next number from the prefix's counter for this year. A 409 means another order took one meanwhile: read
// again. Creating a missing counter can race (two creators both start at 1); setOrderNumber then rejects the duplicate
// and the caller takes the next one.
async function nextOrderNumber(): Promise<string> {
  const prefix = orderNumberPrefix();
  const year = new Date().getUTCFullYear();
  const key = counterKey(prefix, year);
  for (let attempt = 0; attempt < 5; attempt++) {
    const counter = await readObject(ORDER_NUMBER_CONTAINER, key);
    const n = counterNext(counter?.value);
    try {
      await writeObject(ORDER_NUMBER_CONTAINER, key, { next: n + 1 }, counter?.version);
      return formatOrderNumber(prefix, year, n);
    } catch (err) {
      if (statusOf(err) !== 409) throw err;
    }
  }
  throw new Error(`order number counter ${key}: too many concurrent updates`);
}

// Gives the order its number, once. Whoever sets it also creates the order's marker, so the marker has exactly one
// creator. Returns the order with its number. (The SDK documents orderNumber as unique per project and fixed once set.)
export async function assignOrderNumber(orderId: string): Promise<Order> {
  let order = await readOrder(orderId);
  for (let attempt = 0; attempt < 4 && !order.orderNumber; attempt++) {
    const orderNumber = await nextOrderNumber();
    let numbered: Order;
    try {
      numbered = await apiRoot
        .orders()
        .withId({ ID: order.id })
        .post({ body: { version: order.version, actions: [{ action: "setOrderNumber", orderNumber }] } })
        .execute()
        .then((r) => r.body);
    } catch (err) {
      // 409: the order changed (or another worker numbered it): read it again. DuplicateField: a counter race.
      if (statusOf(err) === 409) order = await readOrder(order.id);
      else if (!hasCode(err, "DuplicateField")) throw err;
      continue;
    }
    // Without the marker the steps wait until markerFor creates it (5 minutes later): log, don't fail the numbering.
    await writeObject(MARKER_CONTAINER, order.id, withStep({ steps: {} }, "number", "done", Date.now())).catch((err) =>
      console.error(`order ${order.id}: marker not created`, errorOf(err)),
    );
    return numbered;
  }
  if (!order.orderNumber) throw new Error(`order ${order.id}: no order number after retries`);
  return order;
}

// For the server actions: number the new order before the buyer sees it, and return it numbered. Never throws (the
// order exists either way; the Subscription or the sweep numbers it later): on failure it returns the order as given.
// The other steps run in processOrder after the response.
export async function numberNewOrder(order: Order): Promise<Order> {
  try {
    return await assignOrderNumber(order.id);
  } catch (err) {
    console.error(`order ${order.id}: numbering failed`, errorOf(err));
    return order;
  }
}

// ---------- G1: after-order steps ----------

// The marker, or one created for an order that was numbered by a worker that crashed before writing it. Only orders
// last changed more than 5 minutes ago get one this way, so it never races the worker that numbered the order.
async function markerFor(order: Order): Promise<CustomObject | undefined> {
  const existing = await readObject(MARKER_CONTAINER, order.id);
  if (existing) return existing;
  if (Date.now() - Date.parse(order.lastModifiedAt) < 5 * 60_000) return undefined;
  return writeObject(MARKER_CONTAINER, order.id, withStep({ steps: {} }, "number", "done", Date.now()));
}

// Changes the order's marker: `change` gets the current value and returns the new one, or undefined to leave it. All
// steps of an order share the marker, so a 409 usually means another step was written meanwhile: read it again and
// re-apply, instead of failing a step whose work is already done (which would let it run, and email, twice).
async function updateMarker(
  orderId: string,
  marker: CustomObject,
  change: (current: Marker) => Marker | undefined,
): Promise<CustomObject | undefined> {
  let current: CustomObject | undefined = marker;
  for (let attempt = 0; attempt < 5 && current; attempt++) {
    const next = change(parseMarker(current.value));
    if (!next) return current;
    try {
      return await writeObject(MARKER_CONTAINER, orderId, next, current.version);
    } catch (err) {
      if (statusOf(err) !== 409) throw err;
      current = await readObject(MARKER_CONTAINER, orderId);
    }
  }
  throw new Error(`order ${orderId}: marker kept changing`);
}

// Runs one step if this worker wins the claim. Returns false when the step failed (the caller reports a retry).
async function runStep(order: Order, step: { name: string; run: StepRun }): Promise<boolean> {
  const marker = await markerFor(order);
  if (!marker) return true; // too fresh: the numbering worker is still on it, or the sweep will be
  const now = Date.now();
  const claimedAt = new Date(now).toISOString();
  let claimed = false;
  const afterClaim = await updateMarker(order.id, marker, (m) => {
    // Decided on every read: if another worker claimed or finished this step meanwhile, this one skips it.
    claimed = stepDecision(m, step.name, now) === "run";
    return claimed ? withStep(m, step.name, "claimed", now) : undefined;
  });
  if (!claimed || !afterClaim) return true;
  try {
    await step.run(order);
  } catch (err) {
    console.error(`order ${order.id}: step ${step.name} failed`, errorOf(err));
    // Release the claim so the next event or sweep retries; if this write fails too, the claim expires on its own.
    await updateMarker(order.id, afterClaim, (m) => releaseStep(m, step.name, claimedAt)).catch(() => undefined);
    return false;
  }
  // The work is done: failing here would only make it run again once the claim expires, so log instead of throwing.
  await updateMarker(order.id, afterClaim, (m) => withStep(m, step.name, "done", Date.now())).catch((err) =>
    console.error(`order ${order.id}: step ${step.name} done, but not recorded`, errorOf(err)),
  );
  return true;
}

// Every step for one order. Never throws; false means something is left for a retry.
export async function processOrder(orderId: string): Promise<boolean> {
  try {
    const order = await assignOrderNumber(orderId);
    let ok = true;
    for (const step of STEPS) ok = (await runStep(order, step)) && ok;
    return ok;
  } catch (err) {
    console.error(`order ${orderId}: processing failed`, errorOf(err));
    return false;
  }
}

// The order a Payment belongs to (payment messages from the Subscription).
export async function orderIdForPayment(paymentId: string): Promise<string | undefined> {
  const { body } = await apiRoot
    .orders()
    .get({ queryArgs: { where: `paymentInfo(payments(id="${paymentId}"))`, limit: 1 } })
    .execute();
  return body.results[0]?.id;
}

// The sweep: orders created in the last `hours` that have no number or still have steps to run. Pages through the
// whole window, oldest first, `pageSize` orders and one marker read per page, up to `maxOrders` (commercetools caps
// offset at 10,000); a window that is still bigger is reported as `more`, and the next run continues from the
// oldest unfinished ones.
export async function sweepRecentOrders(
  hours = 24,
  pageSize = 100,
  maxOrders = 2_000,
): Promise<{ checked: number; processed: number; failed: number; more: boolean }> {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  let checked = 0;
  let processed = 0;
  let failed = 0;
  let more = false;
  for (let offset = 0; offset < maxOrders; offset += pageSize) {
    const { body } = await apiRoot
      .orders()
      .get({ queryArgs: { where: `createdAt > "${since}"`, sort: ["createdAt asc", "id asc"], limit: pageSize, offset } })
      .execute();
    const orders = body.results;
    const markers = new Map<string, Marker>();
    if (orders.length && STEP_NAMES.length) {
      const keys = orders.map((o) => `"${o.id}"`).join(", ");
      const { body: objects } = await apiRoot
        .customObjects()
        .withContainer({ container: MARKER_CONTAINER })
        .get({ queryArgs: { where: `key in (${keys})`, limit: orders.length } })
        .execute();
      for (const o of objects.results) markers.set(o.key, parseMarker(o.value));
    }
    const now = Date.now();
    for (const order of orders) {
      if (order.orderNumber && pendingSteps(markers.get(order.id), STEP_NAMES, now).length === 0) continue;
      processed++;
      if (!(await processOrder(order.id))) failed++;
    }
    checked += orders.length;
    if (orders.length < pageSize) return { checked, processed, failed, more: false };
    more = true;
  }
  return { checked, processed, failed, more };
}

// ---------- G3: Payments for invoice and bank-transfer orders ----------

// Gives an invoice or bank-transfer order its Payment (key `order-<order id>`, so a retry finds the one it made) and
// the payment state Pending. Needs manage_payments on the runtime client (RUNTIME_SCOPES).
async function ensurePayment(order: Order): Promise<void> {
  const kind = pendingPaymentKind(order);
  if (!kind) return;
  const payment = await apiRoot
    .payments()
    .post({ body: paymentDraft(order, kind) })
    .execute()
    .then((r) => r.body)
    .catch(async (err) => {
      if (!hasCode(err, "DuplicateField")) throw err;
      return apiRoot
        .payments()
        .withKey({ key: paymentKey(order.id) })
        .get()
        .execute()
        .then((r) => r.body);
    });
  let current = order;
  for (let attempt = 0; attempt < 3; attempt++) {
    const actions = linkPaymentActions(current, payment.id);
    if (actions.length === 0) return;
    try {
      await apiRoot
        .orders()
        .withId({ ID: current.id })
        .post({ body: { version: current.version, actions } })
        .execute();
      return;
    } catch (err) {
      if (statusOf(err) !== 409) throw err;
      current = await readOrder(current.id);
    }
  }
  throw new Error(`order ${order.id}: payment not linked after retries`);
}

// How an order is paid, for pages and documents. Call only for an order the viewer was allowed to read (read with
// their token, or checked by getOrderForViewer): it reads the order's Payments with the admin client. Business orders
// and orders without Payments need no read.
// After an unpaid order was cancelled (a rejected approval): our own Payment of it says so (cancelledPaymentActions).
// Best effort, never throws: the order's own payment state (Failed) is what counts, and it was set with the cancel.
export async function markPaymentCancelled(orderId: string): Promise<void> {
  const payments = apiRoot.payments().withKey({ key: paymentKey(orderId) });
  try {
    for (let attempt = 1; ; attempt++) {
      const payment = await payments
        .get()
        .execute()
        .then((r) => r.body)
        .catch((err) => (statusOf(err) === 404 ? undefined : Promise.reject(err)));
      const actions = payment ? cancelledPaymentActions(payment) : [];
      if (!payment || actions.length === 0) return;
      try {
        await payments.post({ body: { version: payment.version, actions } }).execute();
        return;
      } catch (err) {
        if (statusOf(err) !== 409 || attempt === 2) throw err;
      }
    }
  } catch (err) {
    console.error("marking the payment of a cancelled order failed", orderId, (err as { body?: unknown })?.body ?? err);
  }
}

export async function orderPaymentKind(order: Order): Promise<PaymentKind> {
  const payments = order.paymentInfo?.payments ?? [];
  if (order.businessUnit || payments.length === 0) return paymentKind(order, []);
  const methods = await apiRoot
    .payments()
    .get({ queryArgs: { where: `id in (${payments.map((p) => `"${p.id}"`).join(", ")})`, limit: payments.length } })
    .execute()
    .then((r) => r.body.results.map((p) => p.paymentMethodInfo.method))
    .catch((err): string[] => {
      console.error(`order ${order.id}: payments not readable`, errorOf(err));
      return [];
    });
  return paymentKind(order, methods);
}

// ---------- G2: order confirmation email ----------

// One confirmation per order, to the order's email (or the customer's). The marker makes it "once": a crash between
// sending and marking it done can repeat it after the claim expires, which is the only way a second email goes out.
async function sendConfirmation(order: Order): Promise<void> {
  const to =
    order.customerEmail ??
    (order.customerId
      ? await apiRoot
          .customers()
          .withId({ ID: order.customerId })
          .get()
          .execute()
          .then((r) => r.body.email)
      : undefined);
  if (!to) {
    console.error(`order ${order.id}: no email address for the confirmation`);
    return; // nothing to retry
  }
  const doc = orderDocument(order, "confirmation", { payment: await orderPaymentKind(order) });
  const mail = confirmationEmail(doc, {
    to,
    // Guests have no account page; everyone else can open the order there.
    orderUrl: order.customerId ? `${siteUrl()}/account/orders/${order.id}` : undefined,
    business: Boolean(order.businessUnit),
  });
  if (!(await sendMail(mail))) throw new Error("confirmation email not sent");
}
