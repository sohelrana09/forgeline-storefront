// Puts the shared project back after an order test: cancels the test order and gives its stock back. Runs in the
// Playwright process (Node), never in the browser, with an API client from the environment:
// E2E_CLEANUP_CLIENT_ID / E2E_CLEANUP_CLIENT_SECRET (recommended: a client with only manage_orders and
// manage_products), else the runtime client from .env (CTP_CLIENT_*). Nothing here prints a secret or a token.
//
// commercetools has no "undo" for an order: cancelling keeps it (state Cancelled, its number used up) and does not
// release the stock an order took with inventoryMode ReserveOnOrder, so the stock is added back per line
// (addQuantity on the line's inventory entry). Test orders are recognisable by their PO number or e-mail (E2E-...).

try {
  process.loadEnvFile(".env");
} catch {
  // Variables from the environment instead (CI).
}

const env = (name: string) => process.env[name] ?? "";
const clientId = () => env("E2E_CLEANUP_CLIENT_ID") || env("CTP_CLIENT_ID");
const clientSecret = () => env("E2E_CLEANUP_CLIENT_SECRET") || env("CTP_CLIENT_SECRET");
const NEEDED = ["manage_orders", "manage_products"];

let token: Promise<{ value: string; scopes: string[] }> | undefined;

function accessToken() {
  token ??= (async () => {
    if (!clientId() || !clientSecret() || !env("CTP_AUTH_URL")) throw new Error("No API client for the order test cleanup");
    const res = await fetch(`${env("CTP_AUTH_URL").replace(/\/$/, "")}/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new Error(`Cleanup client: token request failed (${res.status})`);
    const body = (await res.json()) as { access_token: string; scope?: string };
    return { value: body.access_token, scopes: (body.scope ?? "").split(" ").map((s) => s.split(":")[0]) };
  })();
  return token;
}

// Why the order tests can't clean up, or undefined when they can. Checked before a test places anything.
export async function cleanupProblem(): Promise<string | undefined> {
  try {
    const { scopes } = await accessToken();
    const missing = NEEDED.filter((s) => !scopes.includes(s) && !scopes.includes("manage_project"));
    return missing.length ? `the cleanup client lacks ${missing.join(", ")} (set E2E_CLEANUP_CLIENT_ID/SECRET)` : undefined;
  } catch (err) {
    return (err as Error).message;
  }
}

async function ct<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const { value } = await accessToken();
  const res = await fetch(`${env("CTP_API_URL").replace(/\/$/, "")}/${env("CTP_PROJECT_KEY")}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${value}`, "Content-Type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) throw new Error(`Cleanup: ${init?.method ?? "GET"} ${path.split("?")[0]} answered ${res.status}`);
  return (await res.json()) as T;
}

type Order = {
  id: string;
  cart?: { id: string };
  version: number;
  orderState: string;
  orderNumber?: string;
  paymentState?: string;
  inventoryMode?: string;
  custom?: { fields: Record<string, unknown> };
  paymentInfo?: { payments: { id: string; obj?: { paymentStatus?: { interfaceCode?: string } } }[] };
  lineItems: { id: string; quantity: number; variant: { sku?: string }; supplyChannel?: { id: string } }[];
};
type InventoryEntry = { id: string; version: number };

export const readOrder = (id: string) => ct<Order>(`/orders/${encodeURIComponent(id)}?expand=paymentInfo.payments[*]`);

// Waits for the after-order work (numbering is synchronous; the Payment is created by after()).
export async function waitForOrder(id: string, until: (order: Order) => boolean, timeoutMs = 20_000): Promise<Order> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const order = await readOrder(id);
    if (until(order) || Date.now() > end) return order;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

// Cancels the order (unless it already is, e.g. after a rejected approval) and gives its stock back. Safe to call
// for an order that never reserved stock.
export async function cancelTestOrder(id: string) {
  let order = await readOrder(id);
  if (order.orderState !== "Cancelled") {
    order = await ct<Order>(`/orders/${id}`, {
      method: "POST",
      body: {
        version: order.version,
        actions: [
          { action: "changeOrderState", orderState: "Cancelled" },
          // As the storefront does for a rejected order: nobody waits for this payment any more.
          ...(order.paymentState === "Pending" ? [{ action: "changePaymentState", paymentState: "Failed" }] : []),
        ],
      },
    });
  }
  if (order.inventoryMode !== "ReserveOnOrder") return;
  // A rejected order: the storefront gave the stock back itself, line by line, and says so on the order's marker.
  // A cleanup client without Custom Object rights reads no marker, which only happens on orders not cancelled by us.
  const marker = await ct<{ value?: { steps?: Record<string, { state?: string }> } }>(`/custom-objects/order-processing/${id}`).catch(
    () => undefined,
  );
  for (const line of order.lineItems) {
    const sku = line.variant.sku;
    if (!sku || !line.supplyChannel) continue;
    if (marker?.value?.steps?.[`restock:${line.id}`]?.state === "done") continue;
    const where = `sku="${sku.replace(/"/g, "")}" and supplyChannel(id="${line.supplyChannel.id}")`;
    const { results } = await ct<{ results: InventoryEntry[] }>(`/inventory?where=${encodeURIComponent(where)}&limit=1`);
    const entry = results[0];
    if (!entry) continue;
    await ct(`/inventory/${entry.id}`, {
      method: "POST",
      body: { version: entry.version, actions: [{ action: "addQuantity", quantity: line.quantity }] },
    });
  }
}

// Stock of a SKU per supply channel, to check that a test gave back what its order reserved.
export async function stockOf(sku: string): Promise<Record<string, { onStock: number; available: number; version: number }>> {
  const where = `sku="${sku.replace(/"/g, "")}"`;
  const { results } = await ct<{
    results: (InventoryEntry & { supplyChannel?: { id: string }; quantityOnStock: number; availableQuantity: number })[];
  }>(`/inventory?where=${encodeURIComponent(where)}&limit=50`);
  return Object.fromEntries(
    results.map((e) => [e.supplyChannel?.id ?? "-", { onStock: e.quantityOnStock, available: e.availableQuantity, version: e.version }]),
  );
}

// A fresh, empty cart for a demo associate in their unit, created like the storefront creates one (same store,
// currency, country, unit; stock reserved on order). The test points the browser's cart cookie at it, so the order
// is placed from this cart and the person's own carts are never touched. The customer and store come from their
// latest order (the cleanup client can read orders, not customers).
export async function createTestCart(customerEmail: string, unitKey: string): Promise<string> {
  const where = `customerEmail="${customerEmail.replace(/"/g, "")}" and businessUnit(key="${unitKey.replace(/"/g, "")}")`;
  const { results } = await ct<{
    results: { customerId?: string; store?: { key: string }; country?: string; totalPrice: { currencyCode: string } }[];
  }>(`/orders?where=${encodeURIComponent(where)}&sort=${encodeURIComponent("createdAt desc")}&limit=1`);
  const last = results[0];
  if (!last?.customerId || !last.store) throw new Error(`No earlier order of ${customerEmail} in ${unitKey} to copy the cart setup from`);
  const cart = await ct<{ id: string }>(`/in-store/key=${encodeURIComponent(last.store.key)}/carts`, {
    method: "POST",
    body: {
      currency: last.totalPrice.currencyCode,
      ...(last.country && { country: last.country }),
      customerId: last.customerId,
      customerEmail,
      businessUnit: { typeId: "business-unit", key: unitKey },
      inventoryMode: "ReserveOnOrder",
    },
  });
  return cart.id;
}

// Deletes a cart the test created, unless it became an order (then it is kept, as for any order).
export async function deleteTestCart(id: string) {
  const cart = await ct<{ version: number; cartState: string }>(`/carts/${encodeURIComponent(id)}`);
  if (cart.cartState === "Ordered") return;
  await ct(`/carts/${encodeURIComponent(id)}?version=${cart.version}`, { method: "DELETE" });
}

// Carts of a customer in a unit (ids only), to find the cart a flow created on the server, such as a PunchOut session.
export async function cartIdsOf(customerId: string, unitKey: string): Promise<string[]> {
  const where = encodeURIComponent(`customerId="${customerId.replace(/"/g, "")}" and businessUnit(key="${unitKey.replace(/"/g, "")}")`);
  return (await ct<{ results: { id: string }[] }>(`/carts?where=${where}&limit=500`)).results.map((c) => c.id);
}

// Recurring orders a test set up for the buyer (features/recurring-orders): cancelled if still running, then deleted
// with their blueprint cart. Needs manage_recurring_orders on the cleanup client.
type RecurringOrder = { id: string; version: number; recurringOrderState: string; cart: { id: string } };
export async function recurringOrdersOf(customerId: string): Promise<RecurringOrder[]> {
  const where = encodeURIComponent(`customer(id="${customerId}")`);
  return (await ct<{ results: RecurringOrder[] }>(`/recurring-orders?where=${where}&limit=100`)).results;
}
export async function deleteTestRecurringOrder(id: string) {
  let r = await ct<RecurringOrder>(`/recurring-orders/${encodeURIComponent(id)}`);
  if (r.recurringOrderState !== "Canceled" && r.recurringOrderState !== "Expired") {
    r = await ct<RecurringOrder>(`/recurring-orders/${encodeURIComponent(id)}`, {
      method: "POST",
      body: { version: r.version, actions: [{ action: "setRecurringOrderState", recurringOrderState: { type: "canceled" } }] },
    });
  }
  await ct(`/recurring-orders/${encodeURIComponent(id)}?version=${r.version}`, { method: "DELETE" });
  await deleteTestCart(r.cart.id).catch(() => undefined);
}

// A demo associate's customer id, from their latest order (the cleanup client can read orders, not customers).
export async function customerIdByEmail(customerEmail: string): Promise<string> {
  const where = `customerEmail="${customerEmail.replace(/"/g, "")}"`;
  const { results } = await ct<{ results: { customerId?: string }[] }>(
    `/orders?where=${encodeURIComponent(where)}&sort=${encodeURIComponent("createdAt desc")}&limit=1`,
  );
  if (!results[0]?.customerId) throw new Error(`No earlier order of ${customerEmail}`);
  return results[0].customerId;
}
