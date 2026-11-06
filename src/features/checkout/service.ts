import "server-only";
import type { BaseAddress, Cart, Order } from "@commercetools/platform-sdk";
import { apiRoot, customerApiRoot } from "@/lib/commercetools/client";
import type { PricingContext } from "@/features/business-units/types";
import {
  cardPaymentRunning,
  cartAddress,
  getActiveCart,
  getShippingOptions,
  setCartFrozen,
  updateMyCart,
  type CartAuth,
} from "@/features/cart/service";
import { CART_LOCKED_MESSAGE, freezeState } from "@/features/cart/freeze";
import { outOfStockMessage, shortfalls } from "@/features/cart/stock";
import { statusOf } from "@/lib/commercetools/errors";
import { reportEvent } from "@/lib/error-report";
import { str } from "@/lib/predicate";
import { tooManyAttempts } from "@/lib/rate-limit";
import { createCheckoutSession, type CheckoutSession } from "@/lib/commercetools/checkout-session";
export { getShippingOptions, type ShippingOption } from "@/features/cart/service";
import { isQuoteOnly } from "@/features/catalog/utils";
// Checkout: delivery details, PO number and placing the order (server-only).
import type { Session } from "@/features/auth/session";

// Lines priced at or above the quote threshold can't be ordered directly (they go to a quote request).
export const quoteOnlyLines = (cart: Cart) => cart.lineItems.filter((l) => isQuoteOnly(l.price));

export async function applyCheckoutDetails(
  session: CartAuth,
  ctx: PricingContext,
  cart: Cart,
  { addressId, shippingMethodKey }: { addressId: string; shippingMethodKey: string },
) {
  // Addresses are looked up by id on the server: the form can only choose among the unit's (or the consumer's) own.
  const address = ctx.addresses.find((a) => a.id === addressId);
  if (!address) throw new CheckoutError("Choose a delivery address.");
  // Choosing another address must stick even when no method (or one this address doesn't offer) is picked yet.
  return applyDelivery(session, ctx, cart, {
    address,
    billing: ctx.defaultBillingAddress ?? address,
    shippingMethodKey,
    methodOptional: true,
  });
}

// Sets the delivery address (and billing address, and for guests the email) and the shipping method on the cart.
export async function applyDelivery(
  session: CartAuth,
  ctx: PricingContext,
  cart: Cart,
  {
    address,
    billing,
    shippingMethodKey,
    email,
    methodOptional,
  }: {
    address: BaseAddress;
    billing: BaseAddress;
    shippingMethodKey: string;
    email?: string;
    methodOptional?: boolean;
  },
) {
  const options = await getShippingOptions(ctx, address);
  const methodOffered = options.some((o) => o.key === shippingMethodKey);
  if (!methodOffered && !methodOptional) throw new CheckoutError("Choose a delivery method.");

  // Set the address first, then validate the method against the real cart (predicates, tax rates), which a
  // location-only match can't. The cart was just read with the buyer's token, so the admin read is safe.
  const withAddress = await updateMyCart(session, ctx, cart, (c) => [
    { action: "setShippingAddress", address: cartAddress(address) },
    { action: "setBillingAddress", address: cartAddress(billing) },
    ...(email ? [{ action: "setCustomerEmail" as const, email }] : []),
    // B2C carts start without a country (the store has none). commercetools Checkout matches its Application's
    // countries against cart.country, so it follows the delivery country. Prices without a country still match.
    ...(!ctx.country && c.country !== address.country ? [{ action: "setCountry" as const, country: address.country }] : []),
    // Address only: drop a method chosen for the previous address, so the buyer picks one that ships here.
    ...(!methodOffered && c.shippingInfo ? [{ action: "setShippingMethod" as const }] : []),
  ]);
  if (!methodOffered) return withAddress;
  const { body: matching } = await apiRoot
    .shippingMethods()
    .matchingCart()
    .get({ queryArgs: { cartId: withAddress.id } })
    .execute();
  if (!matching.results.some((m) => m.key === shippingMethodKey)) {
    throw new CheckoutError("That delivery method isn't available for this cart.");
  }
  // Recalculate so the totals the buyer reviews reflect current prices, discounts and rates.
  return updateMyCart(session, ctx, withAddress, () => [
    { action: "setShippingMethod", shippingMethod: { typeId: "shipping-method", key: shippingMethodKey } },
    { action: "recalculate", updateProductData: false },
  ]);
}

export class CheckoutError extends Error {}

const PRICES_CHANGED = "Prices changed. Please review your order.";
const gross = (cart: Cart) => cart.taxedPrice?.totalGross.centAmount;

// Brings the cart to today's prices, discounts and rates just before it is ordered: the buyer may have reviewed it
// hours ago, and commercetools orders what the cart says. A different total goes back to them, with the cart updated.
async function repriced(auth: CartAuth, ctx: PricingContext, cart: Cart): Promise<Cart> {
  const fresh = await updateMyCart(auth, ctx, cart, () => [{ action: "recalculate", updateProductData: false }]);
  if (gross(fresh) !== gross(cart)) throw new CheckoutError(PRICES_CHANGED);
  if (quoteOnlyLines(fresh).length > 0) throw new CheckoutError("Remove quote-only items before placing the order.");
  return fresh;
}

export const PO_PATTERN = /^[A-Za-z0-9 ._/#-]{1,35}$/;

// Places the buyer's cart as an order. The PO number can't be set through /me endpoints, so the admin client sets
// it on the cart, but only after the customer token has just read that same cart (proving ownership, unit, store).
export async function placeOrder(
  session: Session,
  ctx: PricingContext,
  cartId: string,
  expectedVersion: number,
  purchaseOrderNumber: string,
) {
  const cart = await getActiveCart(session, cartId, ctx);
  if (!cart) throw new CheckoutError("Your cart is no longer open.");
  if (cart.version !== expectedVersion) throw new CheckoutError("Your cart changed. Please review it and place the order again.");
  if (cart.lineItems.length === 0) throw new CheckoutError("Your cart is empty.");
  if (quoteOnlyLines(cart).length > 0) throw new CheckoutError("Remove quote-only items before placing the order.");
  if (!cart.shippingInfo || !cart.taxedPrice) throw new CheckoutError("Choose a delivery address and method.");
  if (purchaseOrderNumber && !PO_PATTERN.test(purchaseOrderNumber)) {
    throw new CheckoutError("PO number: up to 35 letters, digits, spaces or . _ / # -");
  }

  const fresh = await repriced(session, ctx, cart);
  let version = fresh.version;
  if (purchaseOrderNumber !== (fresh.purchaseOrderNumber ?? "")) {
    const { body } = await apiRoot
      .inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey })
      .carts()
      .withId({ ID: fresh.id })
      .post({
        body: {
          version,
          actions: [{ action: "setPurchaseOrderNumber", purchaseOrderNumber: purchaseOrderNumber || undefined }],
        },
      })
      .execute();
    if (gross(body) !== gross(fresh)) throw new CheckoutError(PRICES_CHANGED);
    version = body.version;
  }

  // The version check makes a double submit fail instead of ordering twice.
  const { body: order } = await customerApiRoot(session.accessToken)
    .inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey })
    .me()
    .orders()
    .post({ body: { id: fresh.id, version } })
    .execute();
  return order;
}

// ---------- Card payments (commercetools Checkout, Payment Only) for consumers and guests ----------

// A B2C cart (consumer or guest) ready to be paid: the caller's own (read with their token), the version they
// reviewed, delivery address + method set, no quote-only machines, and an email for the confirmation.
// A frozen cart whose payment was abandoned reopens at today's prices (never ordered or paid at the old ones);
// a fresh freeze stays only when `paying` by card (a reload continues the same payment).
async function readyB2CCart(
  auth: CartAuth,
  ctx: PricingContext,
  cartId: string,
  expectedVersion: number,
  email: string | undefined,
  { paying }: { paying: boolean },
) {
  let cart = await getActiveCart(auth, cartId, ctx);
  if (!cart) throw new CheckoutError("Your cart is no longer open.");
  if (cart.version !== expectedVersion) throw new CheckoutError("Your cart changed. Please review it and try again.");
  if (cart.lineItems.length === 0) throw new CheckoutError("Your cart is empty.");
  if (quoteOnlyLines(cart).length > 0) throw new CheckoutError("Remove quote-only items before ordering.");
  if (!cart.shippingInfo || !cart.taxedPrice || !cart.shippingAddress) throw new CheckoutError("Choose a delivery address and method.");
  const freeze = freezeState(cart, Date.now());
  if (freeze === "stale" || (freeze === "locked" && !paying)) {
    if (await cardPaymentRunning(cart)) throw new CheckoutError(CART_LOCKED_MESSAGE);
    const open = await setCartFrozen(ctx, cart, false);
    await updateMyCart(auth, ctx, open, () => [{ action: "recalculate", updateProductData: false }]);
    throw new CheckoutError("Your payment timed out. Please review your cart.");
  }
  if (freeze === "open") cart = await repriced(auth, ctx, cart);
  // The order confirmation goes to this address; signed-in customers' carts may not carry it yet.
  if (!cart.customerEmail) {
    if (!email) throw new CheckoutError("Enter your email address.");
    cart = await updateMyCart(auth, ctx, cart, () => [{ action: "setCustomerEmail", email }]);
  }
  return cart;
}

// Opens a Checkout Session for a ready cart; Checkout takes the payment and creates the Order.
// G5: the cart is frozen first, with the version the buyer reviewed (a change since fails with a 409), so Checkout
// charges exactly the reviewed total: commercetools keeps prices, discounts and the shipping method, and the storefront
// refuses cart changes while the freeze is fresh (features/cart/freeze.ts). A cart that is already frozen (the buyer
// reloaded the page and pays again) stays frozen. If no session can be opened, the cart is unfrozen again.
// The money is taken before the order exists, so what can stop the order is checked first: stock, and a payment that
// is already running (a second session could charge twice).
export async function prepareCardPayment(
  auth: CartAuth,
  ctx: PricingContext,
  cartId: string,
  expectedVersion: number,
  email: string | undefined,
): Promise<{ session: CheckoutSession; reviewedCentAmount: number }> {
  let cart = await readyB2CCart(auth, ctx, cartId, expectedVersion, email, { paying: true });
  const freezing = cart.cartState === "Active";
  if (!freezing && (await cardPaymentRunning(cart))) throw new CheckoutError(CART_LOCKED_MESSAGE);
  await checkStock(cart);
  if (freezing) cart = await setCartFrozen(ctx, cart, true);
  try {
    const session = (await openSession(cart.id, cart.version)) ?? (await rememberSession(cart, await createCheckoutSession(cart.id)));
    return { session, reviewedCentAmount: cart.taxedPrice!.totalGross.centAmount };
  } catch (err) {
    if (freezing) await setCartFrozen(ctx, cart, false).catch(() => undefined); // else it unlocks after FREEZE_TTL_MS
    throw err;
  }
}

// The same check commercetools makes when it creates the order, made before the buyer pays. Orders can still take the
// last unit between here and there; then Checkout refuses or the money comes back as an orphan payment alert.
async function checkStock(cart: Cart) {
  if (cart.inventoryMode !== "ReserveOnOrder") return;
  const lines = cart.lineItems.flatMap((l) =>
    l.variant.sku && l.supplyChannel ? [{ sku: l.variant.sku, channel: l.supplyChannel.id, quantity: l.quantity }] : [],
  );
  if (lines.length === 0) return;
  const { body } = await apiRoot
    .inventory()
    .get({ queryArgs: { where: `sku in (${[...new Set(lines.map((l) => str(l.sku)))].join(", ")})`, limit: 500 } })
    .execute();
  const short = shortfalls(lines, body.results);
  if (short.length > 0) throw new CheckoutError(outOfStockMessage(short));
}

// One Checkout session per frozen cart version: two tabs share it instead of each being able to charge. The object is
// only a convenience (running payments are refused above), so failing to read or write it changes nothing.
const SESSION_CONTAINER = "checkout-session";
const SESSION_TTL_MS = 15 * 60_000;
type StoredSession = { session: CheckoutSession; cartVersion: number; expiresAt: number };

async function openSession(cartId: string, cartVersion: number): Promise<CheckoutSession | undefined> {
  const stored = await apiRoot
    .customObjects()
    .withContainerAndKey({ container: SESSION_CONTAINER, key: cartId })
    .get()
    .execute()
    .then((r) => r.body.value as StoredSession)
    .catch(() => undefined);
  return stored?.cartVersion === cartVersion && stored.expiresAt > Date.now() ? stored.session : undefined;
}

async function rememberSession(cart: Cart, session: CheckoutSession): Promise<CheckoutSession> {
  const value: StoredSession = { session, cartVersion: cart.version, expiresAt: Date.now() + SESSION_TTL_MS };
  await apiRoot
    .customObjects()
    .post({ body: { container: SESSION_CONTAINER, key: cart.id, value } })
    .execute()
    .catch((err) => reportEvent("checkout_session_not_stored", err, { cartId: cart.id }));
  return session;
}

// The buyer cancels the open card payment: their own cart (read with their token) is unfrozen, so it can change again.
// Refused once the payment is running: the buyer would change a cart that is being paid for.
export async function cancelCardPayment(auth: CartAuth, ctx: PricingContext, cartId: string): Promise<void> {
  const cart = await getActiveCart(auth, cartId, ctx);
  if (cart?.cartState !== "Frozen") return;
  if (await cardPaymentRunning(cart)) throw new CheckoutError(CART_LOCKED_MESSAGE);
  await setCartFrozen(ctx, cart, false);
}

// Bank transfer takes stock before any money arrives, so a guest (no account behind the order) can't reserve much.
const unpaidOrderMaxQuantity = () => Number(process.env.UNPAID_ORDER_MAX_QUANTITY) || 100;

// While card payments are switched off (B2C_CARD_PAYMENTS): the B2C order is placed straight away with the caller's
// own token and paid by bank transfer afterwards.
export async function placeBankTransferOrder(
  auth: CartAuth,
  ctx: PricingContext & { guest?: boolean },
  cartId: string,
  expectedVersion: number,
  email: string | undefined,
) {
  const cart = await readyB2CCart(auth, ctx, cartId, expectedVersion, email, { paying: false });
  if (ctx.guest) {
    const quantity = cart.lineItems.reduce((total, l) => total + l.quantity, 0);
    if (quantity > unpaidOrderMaxQuantity()) throw new CheckoutError("For an order this large, please create an account or contact us.");
    if (await tooManyAttempts(`order-email:${cart.customerEmail?.toLowerCase()}`, 5)) {
      throw new CheckoutError("Too many orders for this email address. Please wait a few minutes and try again.");
    }
  }
  const { body: order } = await customerApiRoot(auth.accessToken)
    .inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey })
    .me()
    .orders()
    .post({ body: { id: cart.id, version: cart.version } })
    .execute();
  return order;
}

// The order Checkout created for the caller's cart, read with the caller's own token (a guest's anonymous token
// sees their own orders too), and only if it really came from that cart. Undefined only when commercetools says there
// is no such order; an outage throws, and must not read as "this payment has no order".
export async function paidOrder(auth: CartAuth, ctx: PricingContext, orderId: string, cartId: string): Promise<Order | undefined> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(orderId)) return undefined;
  const order = await customerApiRoot(auth.accessToken)
    .inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey })
    .me()
    .orders()
    .withId({ ID: orderId })
    .get()
    .execute()
    .then((r) => r.body)
    .catch((err) => {
      if (statusOf(err) === 404) return undefined;
      throw err;
    });
  return order?.cart?.id === cartId ? order : undefined;
}

// A guest's own order, read with their anonymous token.
export const guestOrder = (auth: CartAuth, ctx: PricingContext, orderId: string): Promise<Order | undefined> =>
  customerApiRoot(auth.accessToken)
    .inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey })
    .me()
    .orders()
    .withId({ ID: orderId })
    .get()
    .execute()
    .then((r) => r.body)
    .catch(() => undefined);

// The order a cart turned into (Checkout creates it in the browser flow). Lets checkout recover when the success
// callback never reached us (closed tab, lost connection): the cart is then "Ordered", not gone.
export async function orderFromCart(auth: CartAuth, ctx: PricingContext, cartId: string): Promise<Order | undefined> {
  const { body } = await customerApiRoot(auth.accessToken)
    .inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey })
    .me()
    .orders()
    .get({ queryArgs: { where: `cart(id="${cartId.replace(/[^0-9a-f-]/g, "")}")`, limit: 1 } })
    .execute()
    .catch(() => ({ body: { results: [] as Order[] } }));
  return body.results[0];
}
