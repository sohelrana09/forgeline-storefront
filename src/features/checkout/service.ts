import "server-only";
import type { BaseAddress, Cart, Order } from "@commercetools/platform-sdk";
import { apiRoot, customerApiRoot } from "@/lib/commercetools/client";
import type { PricingContext } from "@/features/business-units/types";
import { cartAddress, getActiveCart, getShippingOptions, updateMyCart, type CartAuth } from "@/features/cart/service";
import { createCheckoutSession, type CheckoutSession } from "@/lib/commercetools/checkout-session";
export { getShippingOptions, type ShippingOption } from "@/features/cart/service";
import { isQuoteOnly } from "@/features/catalog/utils";
// Checkout: delivery details, PO number and placing the order (server-only).
import type { Session } from "@/features/auth/session";

// Lines priced at or above the quote threshold can't be ordered directly (E4 turns them into quotes).
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

  let version = cart.version;
  if (purchaseOrderNumber !== (cart.purchaseOrderNumber ?? "")) {
    const { body } = await apiRoot
      .inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey })
      .carts()
      .withId({ ID: cart.id })
      .post({
        body: {
          version,
          actions: [{ action: "setPurchaseOrderNumber", purchaseOrderNumber: purchaseOrderNumber || undefined }],
        },
      })
      .execute();
    version = body.version;
  }

  // The version check makes a double submit fail instead of ordering twice.
  const { body: order } = await customerApiRoot(session.accessToken)
    .inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey })
    .me()
    .orders()
    .post({ body: { id: cart.id, version } })
    .execute();
  return order;
}

// ---------- Card payments (commercetools Checkout, Payment Only) for consumers and guests ----------

// Checks the cart the caller owns (read with their own token) is ready to pay, then opens a Checkout Session for
// it. Checkout takes the payment and creates the Order; `expectedVersion` makes sure the buyer pays for the cart
// they reviewed.
// A B2C cart (consumer or guest) ready to be paid: the caller's own (read with their token), the version they
// reviewed, delivery address + method set, no quote-only machines, and an email for the confirmation.
async function readyB2CCart(auth: CartAuth, ctx: PricingContext, cartId: string, expectedVersion: number, email: string | undefined) {
  let cart = await getActiveCart(auth, cartId, ctx);
  if (!cart) throw new CheckoutError("Your cart is no longer open.");
  if (cart.version !== expectedVersion) throw new CheckoutError("Your cart changed. Please review it and try again.");
  if (cart.lineItems.length === 0) throw new CheckoutError("Your cart is empty.");
  if (quoteOnlyLines(cart).length > 0) throw new CheckoutError("Remove quote-only items before ordering.");
  if (!cart.shippingInfo || !cart.taxedPrice || !cart.shippingAddress) throw new CheckoutError("Choose a delivery address and method.");
  // The order confirmation goes to this address; signed-in customers' carts may not carry it yet.
  if (!cart.customerEmail) {
    if (!email) throw new CheckoutError("Enter your email address.");
    cart = await updateMyCart(auth, ctx, cart, () => [{ action: "setCustomerEmail", email }]);
  }
  return cart;
}

export async function prepareCardPayment(
  auth: CartAuth,
  ctx: PricingContext,
  cartId: string,
  expectedVersion: number,
  email: string | undefined,
): Promise<{ session: CheckoutSession; reviewedCentAmount: number }> {
  const cart = await readyB2CCart(auth, ctx, cartId, expectedVersion, email);
  return { session: await createCheckoutSession(cart.id), reviewedCentAmount: cart.taxedPrice!.totalGross.centAmount };
}

// While card payments are switched off (B2C_CARD_PAYMENTS): the B2C order is placed straight away with the caller's
// own token and paid by bank transfer afterwards. The version check makes a double submit fail instead of ordering twice.
export async function placeBankTransferOrder(
  auth: CartAuth,
  ctx: PricingContext,
  cartId: string,
  expectedVersion: number,
  email: string | undefined,
) {
  const cart = await readyB2CCart(auth, ctx, cartId, expectedVersion, email);
  const { body: order } = await customerApiRoot(auth.accessToken)
    .inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey })
    .me()
    .orders()
    .post({ body: { id: cart.id, version: cart.version } })
    .execute();
  return order;
}

// The order Checkout created for the caller's cart, read with the caller's own token (a guest's anonymous token
// sees their own orders too), and only if it really came from that cart.
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
    .catch(() => undefined);
  return order?.cart?.id === cartId ? order : undefined;
}

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
