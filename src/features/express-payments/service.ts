import "server-only";
import type { BaseAddress, Cart } from "@commercetools/platform-sdk";
import { projectKey } from "@/lib/commercetools/client";
import { checkoutRegion, createCheckoutSession, type CheckoutSession } from "@/lib/commercetools/checkout-session";
import type { PricingContext } from "@/features/business-units/types";
import {
  cardPaymentRunning,
  getActiveCart,
  getShippingOptions,
  readPaymentLock,
  savePaymentLock,
  type CartAuth,
} from "@/features/cart/service";
import { CART_LOCKED_MESSAGE, SESSION_TTL_MS } from "@/features/cart/payment-lock";
import { outOfStockMessage } from "@/features/cart/stock";
import { CheckoutError, applyDelivery, cartShortfalls, quoteOnlyLines } from "@/features/checkout/service";
import { walletShippingMethods } from "@/features/express-payments/express";

// Express payments (docs/features/express-payments.md). Every call reads the caller's own cart with their own token
// (getActiveCart) and changes it through the same paths as the checkout form (applyDelivery). The cart is locked for
// payment only once the buyer confirms in the wallet (onPaymentSubmit), as "Pay by card" does.

async function openCart(auth: CartAuth, ctx: PricingContext, cartId: string): Promise<Cart> {
  const cart = await getActiveCart(auth, cartId, ctx);
  if (!cart || cart.lineItems.length === 0) throw new CheckoutError("Your cart is empty.");
  if (quoteOnlyLines(cart).length > 0) throw new CheckoutError("Remove quote-only items to pay now.");
  if (await cardPaymentRunning(cart)) throw new CheckoutError(CART_LOCKED_MESSAGE);
  return cart;
}

const linesTotal = (cart: Cart) => cart.lineItems.reduce((sum, l) => sum + l.totalPrice.centAmount, 0);

export async function prepareExpress(auth: CartAuth, ctx: PricingContext, cartId: string) {
  const cart = await openCart(auth, ctx, cartId);
  const short = await cartShortfalls(cart);
  if (short.length > 0) throw new CheckoutError(outOfStockMessage(short));
  const session = await createCheckoutSession(cart.id);
  return {
    session,
    countryCode: cart.country ?? cart.shippingAddress?.country ?? ctx.country ?? "DE",
    initialAmount: {
      centAmount: cart.totalPrice.centAmount,
      currencyCode: cart.totalPrice.currencyCode,
      fractionDigits: cart.totalPrice.fractionDigits,
    },
  };
}

// The wallet shares a partial address: set it (with the default method there) so rates and tax follow.
export async function setExpressAddress(auth: CartAuth, ctx: PricingContext, cartId: string, address: BaseAddress) {
  const cart = await openCart(auth, ctx, cartId);
  await applyDelivery(auth, ctx, cart, { address, billing: address, shippingMethodKey: cart.shippingInfo?.shippingMethod?.obj?.key ?? "" });
}

export async function expressShippingMethods(auth: CartAuth, ctx: PricingContext, cartId: string) {
  const cart = await openCart(auth, ctx, cartId);
  if (!cart.shippingAddress?.country) return [];
  const options = await getShippingOptions(ctx, cart.shippingAddress);
  const selected = options.find((o) => o.id === cart.shippingInfo?.shippingMethod?.id)?.key;
  return walletShippingMethods(options, linesTotal(cart), selected);
}

export async function setExpressMethod(auth: CartAuth, ctx: PricingContext, cartId: string, key: string) {
  const cart = await openCart(auth, ctx, cartId);
  if (!cart.shippingAddress?.country) throw new CheckoutError("Choose a delivery address first.");
  await applyDelivery(auth, ctx, cart, {
    address: cart.shippingAddress,
    billing: cart.billingAddress ?? cart.shippingAddress,
    shippingMethodKey: key,
  });
}

// The buyer confirmed in the wallet: full addresses (and a guest's email) on the cart, then the cart holds for the
// payment. Returns the total they confirmed, to compare with the order.
export async function submitExpress(
  auth: CartAuth,
  ctx: PricingContext,
  cartId: string,
  sessionId: string,
  details: { shipping: BaseAddress; billing: BaseAddress; email?: string },
): Promise<number> {
  const cart = await openCart(auth, ctx, cartId);
  const methodId = cart.shippingInfo?.shippingMethod?.id;
  const key = methodId ? (await getShippingOptions(ctx, details.shipping)).find((o) => o.id === methodId)?.key : undefined;
  const updated = await applyDelivery(auth, ctx, cart, {
    address: details.shipping,
    billing: details.billing,
    shippingMethodKey: key ?? "",
    email: details.email,
  });
  if (!updated.shippingInfo) throw new CheckoutError("We can't deliver to that address.");
  const short = await cartShortfalls(updated);
  if (short.length > 0) throw new CheckoutError(outOfStockMessage(short));
  const total = updated.taxedPrice?.totalGross.centAmount ?? updated.totalPrice.centAmount;
  const lock = await readPaymentLock(updated);
  const now = Date.now();
  const session: CheckoutSession = { sessionId, projectKey, region: checkoutRegion() };
  await savePaymentLock(updated.id, {
    session,
    reviewedCentAmount: total,
    lockedAt: lock?.lockedAt ?? now,
    expiresAt: now + SESSION_TTL_MS,
    soft: false,
  });
  return total;
}
