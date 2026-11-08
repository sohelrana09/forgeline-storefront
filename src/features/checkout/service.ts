import "server-only";
import type { BaseAddress, Cart, CartUpdateAction, MyCartUpdateAction, Order } from "@commercetools/platform-sdk";
import { procurementActions, type Procurement } from "@/features/checkout/procurement";
import { checkOrderBudget } from "@/features/spending-limits/service";
import { apiRoot, customerApiRoot } from "@/lib/commercetools/client";
import type { PricingContext } from "@/features/business-units/types";
import {
  cardPaymentRunning,
  cartAddress,
  getActiveCart,
  getShippingOptions,
  clearPaymentLock,
  readPaymentLock,
  savePaymentLock,
  unfreezeCart,
  updateMyCart,
  type CartAuth,
} from "@/features/cart/service";
import { CART_LOCKED_MESSAGE, SESSION_TTL_MS, lockState, type PaymentLock } from "@/features/cart/payment-lock";
import { outOfStockMessage, shortfalls } from "@/features/cart/stock";
import { hasCode, statusOf } from "@/lib/commercetools/errors";
import { str } from "@/lib/predicate";
import { tooManyAttempts } from "@/lib/rate-limit";
import { createCheckoutSession, type CheckoutSession } from "@/lib/commercetools/checkout-session";
import { ownBilling, pickMethod, removePaymentActions } from "@/features/checkout/utils";
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
  });
}

// The billing address of a consumer's or guest's cart (the payment step's billing section). Refused while a payment
// is open (updateMyCart).
export async function setBillingAddress(session: CartAuth, ctx: PricingContext, cart: Cart, address: BaseAddress) {
  return updateMyCart(session, ctx, cart, () => [{ action: "setBillingAddress", address: cartAddress(address) }]);
}

// Sets the delivery address (and billing address, and for guests the email) and a shipping method on the cart, in one
// update: the buyer's method when it ships to this address, else the default one (pickMethod), so a single save brings
// the totals and the payment step. commercetools checks the method against the updated cart itself (zones, predicates)
// and answers ShippingMethodDoesNotMatchCart; the address is then saved on its own and the buyer picks a method.
export async function applyDelivery(
  session: CartAuth,
  ctx: PricingContext,
  cart: Cart,
  {
    address,
    billing,
    shippingMethodKey,
    email,
  }: {
    address: BaseAddress;
    billing: BaseAddress;
    shippingMethodKey: string;
    email?: string;
  },
) {
  const methodKey = pickMethod(await getShippingOptions(ctx, address), shippingMethodKey);
  const addressActions = (c: Cart): MyCartUpdateAction[] => [
    { action: "setShippingAddress", address: cartAddress(address) },
    // A billing address the buyer chose separately stays (features/checkout/utils.ts ownBilling).
    ...(ownBilling(c) ? [] : [{ action: "setBillingAddress" as const, address: cartAddress(billing) }]),
    ...(email && c.customerEmail !== email ? [{ action: "setCustomerEmail" as const, email }] : []),
    // B2C carts start without a country (the store has none). commercetools Checkout matches its Application's
    // countries against cart.country, so it follows the delivery country. Prices without a country still match.
    ...(!ctx.country && c.country !== address.country ? [{ action: "setCountry" as const, country: address.country }] : []),
  ];
  // Without a method for this address, drop one chosen for the previous address.
  const addressOnly = (c: Cart): MyCartUpdateAction[] => [
    ...addressActions(c),
    ...(c.shippingInfo ? [{ action: "setShippingMethod" as const }] : []),
  ];
  if (!methodKey) return updateMyCart(session, ctx, cart, addressOnly);
  try {
    return await updateMyCart(session, ctx, cart, (c) => [
      ...addressActions(c),
      { action: "setShippingMethod", shippingMethod: { typeId: "shipping-method", key: methodKey } },
      // The totals the buyer reviews reflect current prices and discounts (shipping and tax follow every update).
      { action: "recalculate", updateProductData: false },
    ]);
  } catch (err) {
    if (!hasCode(err, "ShippingMethodDoesNotMatchCart")) throw err;
    const withAddress = await updateMyCart(session, ctx, cart, addressOnly);
    if (methodKey === shippingMethodKey) throw new CheckoutError("That delivery method isn't available for this cart.");
    return withAddress;
  }
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

// Places the buyer's cart as an order. The PO number (and the procurement fields) can't be set through /me endpoints, so the admin client sets
// it on the cart, but only after the customer token has just read that same cart (proving ownership, unit, store).
export async function placeOrder(
  session: Session,
  ctx: PricingContext,
  cartId: string,
  expectedVersion: number,
  purchaseOrderNumber: string,
  // Procurement fields (features/checkout/procurement.ts), already validated; undefined when the feature is off.
  procurement?: Procurement,
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
  // Spending budgets (features/spending-limits), on the repriced net total: block mode refuses, warn mode lets the
  // order through and the caller tells the buyer.
  const budget = await checkOrderBudget(ctx, session.customerId, fresh.taxedPrice?.totalNet ?? fresh.totalPrice);
  if (budget.decision === "block") throw new CheckoutError(budget.message);
  let version = fresh.version;
  // PO number and procurement fields in one update, by the admin client (the /me endpoints can't set either).
  const actions: CartUpdateAction[] = [
    ...(purchaseOrderNumber !== (fresh.purchaseOrderNumber ?? "")
      ? [{ action: "setPurchaseOrderNumber" as const, purchaseOrderNumber: purchaseOrderNumber || undefined }]
      : []),
    ...(procurement ? procurementActions(fresh.custom, procurement) : []),
  ];
  if (actions.length > 0) {
    const { body } = await apiRoot
      .inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey })
      .carts()
      .withId({ ID: fresh.id })
      .post({ body: { version, actions } })
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
  return { order, budgetWarning: budget.decision === "warn" ? budget.message : undefined };
}

// ---------- Card payments (commercetools Checkout, Payment Only) for consumers and guests ----------

// A B2C cart (consumer or guest) ready to be paid: the caller's own (read with their token), the version they
// reviewed, delivery address + method set, no quote-only machines, and an email for the confirmation.
// A payment lock (features/cart/payment-lock.ts) stays only when `paying` by card and still fresh: a reload continues
// the same payment. An old lock, or one in the way of a bank transfer, goes unless a payment is running; the cart is
// then repriced like any other. Carts frozen by the storefront's old freeze are unfrozen first: Checkout refuses them.
async function readyB2CCart(
  auth: CartAuth,
  ctx: PricingContext,
  cartId: string,
  expectedVersion: number,
  email: string | undefined,
  { paying }: { paying: boolean },
): Promise<{ cart: Cart; lock?: PaymentLock }> {
  let cart = await getActiveCart(auth, cartId, ctx);
  if (!cart) throw new CheckoutError("Your cart is no longer open.");
  if (cart.version !== expectedVersion) throw new CheckoutError("Your cart changed. Please review it and try again.");
  if (cart.lineItems.length === 0) throw new CheckoutError("Your cart is empty.");
  if (quoteOnlyLines(cart).length > 0) throw new CheckoutError("Remove quote-only items before ordering.");
  if (!cart.shippingInfo || !cart.taxedPrice || !cart.shippingAddress) throw new CheckoutError("Choose a delivery address and method.");
  if (cart.cartState === "Frozen") {
    if (await cardPaymentRunning(cart)) throw new CheckoutError(CART_LOCKED_MESSAGE);
    cart = await unfreezeCart(ctx, cart);
  }
  let lock = await readPaymentLock(cart);
  const state = lockState(lock, Date.now());
  if (state === "stale" || (state !== "open" && !paying)) {
    if (await cardPaymentRunning(cart)) throw new CheckoutError(CART_LOCKED_MESSAGE);
    await clearPaymentLock(cart.id);
    lock = undefined;
  }
  if (!lock) cart = await repriced(auth, ctx, cart);
  // The order confirmation goes to this address; signed-in customers' carts may not carry it yet (a locked cart has it:
  // it was set before the lock).
  if (!cart.customerEmail) {
    if (!email) throw new CheckoutError("Enter your email address.");
    cart = await updateMyCart(auth, ctx, cart, () => [{ action: "setCustomerEmail", email }]);
  }
  return { cart, lock };
}

// Opens a Checkout Session for a ready cart; Checkout takes the payment and creates the Order.
// G5: the session is stored as the cart's payment lock with the total the buyer reviewed, and the storefront refuses
// cart changes while the lock is fresh (features/cart/payment-lock.ts), so Checkout charges the reviewed total. A reload
// or a second tab gets the same session while it lasts (SESSION_TTL_MS) instead of a second one that could charge too.
// The money is taken before the order exists, so what can stop the order is checked first: stock, and a payment that
// is already running. A change made in another tab in the moment between the session and the lock is caught after the
// payment: the order page flags a total that differs from the reviewed one.
export async function prepareCardPayment(
  auth: CartAuth,
  ctx: PricingContext,
  cartId: string,
  expectedVersion: number,
  email: string | undefined,
  // Opened by selecting card or PayPal, not by asking to pay: a soft lock (features/cart/payment-lock.ts).
  soft = false,
): Promise<{ session: CheckoutSession; reviewedCentAmount: number; soft: boolean }> {
  const { cart, lock } = await readyB2CCart(auth, ctx, cartId, expectedVersion, email, { paying: true });
  const now = Date.now();
  if (lock && lock.expiresAt > now) {
    // The buyer now asks to pay in a session that selecting a method opened: from here on the cart holds.
    if (lock.soft && !soft) await savePaymentLock(cart.id, { ...lock, soft: false });
    return { session: lock.session, reviewedCentAmount: lock.reviewedCentAmount, soft: Boolean(lock.soft) && soft };
  }
  if (await cardPaymentRunning(cart)) throw new CheckoutError(CART_LOCKED_MESSAGE);
  await checkStock(cart);
  const session = await createCheckoutSession(cart.id);
  // A lock whose session ran out keeps its start (it can't be renewed for ever) and the total reviewed back then.
  const reviewedCentAmount = lock?.reviewedCentAmount ?? cart.taxedPrice!.totalGross.centAmount;
  // A full lock stays full when its session is renewed.
  const softLock = soft && (lock?.soft ?? true);
  await savePaymentLock(cart.id, {
    session,
    reviewedCentAmount,
    lockedAt: lock?.lockedAt ?? now,
    expiresAt: now + SESSION_TTL_MS,
    soft: softLock,
  });
  return { session, reviewedCentAmount, soft: softLock };
}

// The buyer pressed Checkout's pay button in a session that selecting card or PayPal opened: from here on the cart
// holds (a full lock), as it does after "Pay by card". Only the caller's own cart (read with their token), only the
// session it was opened for, and only a fresh soft lock; anything else is left as it is.
export async function holdCardPayment(auth: CartAuth, ctx: PricingContext, cartId: string, sessionId: string): Promise<void> {
  const cart = await getActiveCart(auth, cartId, ctx);
  if (!cart) return;
  const lock = await readPaymentLock(cart);
  if (!lock?.soft || lock.session.sessionId !== sessionId || lock.expiresAt <= Date.now()) return;
  await savePaymentLock(cart.id, { ...lock, soft: false });
}

// The same check commercetools makes when it creates the order, made before the buyer pays. Orders can still take the
// last unit between here and there; then Checkout refuses or the money comes back as an orphan payment alert.
async function checkStock(cart: Cart) {
  const short = await cartShortfalls(cart);
  if (short.length > 0) throw new CheckoutError(outOfStockMessage(short));
}

// SKUs of a cart that its supply channel can't cover now (none for carts that don't reserve stock). Also used
// before a recurring order runs (features/recurring-orders).
export async function cartShortfalls(cart: Cart): Promise<string[]> {
  if (cart.inventoryMode !== "ReserveOnOrder") return [];
  const lines = cart.lineItems.flatMap((l) =>
    l.variant.sku && l.supplyChannel ? [{ sku: l.variant.sku, channel: l.supplyChannel.id, quantity: l.quantity }] : [],
  );
  if (lines.length === 0) return [];
  const { body } = await apiRoot
    .inventory()
    .get({ queryArgs: { where: `sku in (${[...new Set(lines.map((l) => str(l.sku)))].join(", ")})`, limit: 500 } })
    .execute();
  return shortfalls(lines, body.results);
}

// The buyer cancels the open payment: the lock on their own cart (read with their token) goes, so it can change again.
// Refused once the payment is running: the buyer would change a cart that is being paid for.
export async function cancelCardPayment(auth: CartAuth, ctx: PricingContext, cartId: string): Promise<void> {
  const cart = await getActiveCart(auth, cartId, ctx);
  if (!cart) return;
  if (await cardPaymentRunning(cart)) throw new CheckoutError(CART_LOCKED_MESSAGE);
  if (cart.cartState === "Frozen") await unfreezeCart(ctx, cart);
  await clearPaymentLock(cart.id);
}

// Bank transfer takes stock before any money arrives, so a guest (no account behind the order) can't reserve much.
const unpaidOrderMaxQuantity = () => Number(process.env.UNPAID_ORDER_MAX_QUANTITY) || 100;

// The B2C order is placed straight away with the caller's own token and paid by bank transfer afterwards. A card or
// PayPal attempt the buyer gave up on can leave its Payment on the cart: it goes first, or the order would count as
// paid online and never get its bank-transfer Payment. One that is running or took money keeps the cart locked.
export async function placeBankTransferOrder(
  auth: CartAuth,
  ctx: PricingContext & { guest?: boolean },
  cartId: string,
  expectedVersion: number,
  email: string | undefined,
) {
  let { cart } = await readyB2CCart(auth, ctx, cartId, expectedVersion, email, { paying: false });
  if (await cardPaymentRunning(cart)) throw new CheckoutError(CART_LOCKED_MESSAGE);
  if (cart.paymentInfo?.payments.length) {
    cart = await updateMyCart(auth, ctx, cart, removePaymentActions);
  }
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
