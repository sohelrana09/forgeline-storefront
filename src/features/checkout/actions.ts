"use server";

import { cookies } from "next/headers";
import { revalidatePath, refresh } from "next/cache";
import { after } from "next/server";
import { redirect, unstable_rethrow } from "next/navigation";
import { hasPermissionNow } from "@/features/business-units/service";
import { ORDER_PERMISSION } from "@/features/business-units/utils";
import { clearPaymentLock, getActiveCart } from "@/features/cart/service";
import {
  applyCheckoutDetails,
  applyDelivery,
  cancelCardPayment as releaseCardPayment,
  CheckoutError,
  paidOrder,
  placeBankTransferOrder,
  placeOrder,
  prepareCardPayment,
  setBillingAddress,
} from "@/features/checkout/service";
import { numberNewOrder, processOrder } from "@/features/order-processing/service";
import { bankTransferEnabled, checkoutPaymentsEnabled } from "@/lib/commercetools/checkout-session";
import type { CheckoutSession } from "@/lib/commercetools/checkout-session";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { parseAddress } from "@/features/account/utils";
import { CONSUMER_COUNTRIES } from "@/features/business-units/service";
import { cartCookie, saveGuest } from "@/features/auth/session";
import { actorKey, requireBrowseContext, requireShopContext } from "@/features/business-units/context";
import { getMe, withMyAddresses } from "@/features/account/service";
import type { BuyerContext } from "@/features/business-units/types";
import type { BaseAddress, Order } from "@commercetools/platform-sdk";
import { AUTOMATED_MESSAGE, isAutomated } from "@/lib/bot-check";
import { CartLockedError } from "@/features/cart/payment-lock";
import { orderErrorMessage } from "@/features/checkout/utils";
import { reportEvent } from "@/lib/error-report";
import { flash } from "@/lib/flash";

// Checkout has its own layout (route group "(checkout)"): refresh it as well as the shop pages (header cart, totals).
function refreshPages() {
  refresh();
}

// Public endpoints: both act only on the signed-in customer's own open cart. In a business unit only buyers may
// use them (checked live); consumers always may, for their personal cart.
const mayOrder = async (context: BuyerContext, customerId: string) =>
  context.canOrder && (context.consumer || (await hasPermissionNow(context.businessUnitKey, customerId, ORDER_PERMISSION)));

export type DeliveryState = { error?: string };

export async function chooseDelivery(_prev: DeliveryState, formData: FormData): Promise<DeliveryState> {
  const { session, context: selected, cartId } = await requireShopContext();
  if (!(await mayOrder(selected, session.customerId))) return { error: "Only buyers can place orders." };
  if (await tooManyAttempts(`delivery:${session.customerId}`, 60)) {
    return { error: "Too many changes. Please wait a few minutes and try again." };
  }
  const cart = await getActiveCart(session, cartId, selected);
  if (!cart) return { error: "Your cart is no longer open." };
  try {
    // Consumers choose among their own addresses, business buyers among the unit's.
    const context = await withMyAddresses(session, selected);
    await applyCheckoutDetails(session, context, cart, {
      addressId: String(formData.get("addressId") ?? ""),
      shippingMethodKey: String(formData.get("shippingMethodKey") ?? ""),
    });
  } catch (err) {
    unstable_rethrow(err); // signed out (revoked token)
    if (err instanceof CheckoutError || err instanceof CartLockedError) return { error: err.message };
    console.error("checkout details failed", (err as { body?: unknown })?.body ?? err);
    return { error: "Your choice could not be saved. Please try again." };
  }
  refreshPages();
  return {};
}

export type PlaceOrderState = { error?: string };

export async function placeOrderAction(_prev: PlaceOrderState, formData: FormData): Promise<PlaceOrderState> {
  if (await isAutomated()) return { error: AUTOMATED_MESSAGE };
  const { session, context, cartId } = await requireShopContext();
  if (!cartId || !(await mayOrder(context, session.customerId))) {
    return { error: "Only buyers with an open cart can place orders." };
  }

  // Invoice + PO is for business buyers; consumers and guests pay by card (startCardPayment).
  if (context.consumer) return { error: "Please choose a payment method at checkout." };
  // G8: the same limits as the B2C order actions, but per buyer instead of per IP: a company's buyers often share
  // one office address. The bucket is shared with ordering from quotes.
  // Per buyer, not per cart: the cart id is a cookie the caller picks.
  if (await tooManyAttempts(`order-customer:${session.customerId}`, 30)) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  let order: Order;
  try {
    order = await placeOrder(
      session,
      context,
      cartId,
      Number(formData.get("cartVersion")),
      String(formData.get("purchaseOrderNumber") ?? "").trim(),
    );
  } catch (err) {
    unstable_rethrow(err); // signed out (revoked token)
    // Re-render the page so the form carries the cart's current version (setting the PO may have bumped it).
    revalidatePath("/checkout");
    if (err instanceof CheckoutError) return { error: err.message };
    console.error("place order failed", (err as { body?: unknown })?.body ?? err);
    return { error: orderErrorMessage(err) ?? "The order could not be placed. Please try again." };
  }

  (await cookies()).delete(cartCookie(context.businessUnitKey));
  refreshPages();
  const placed = await numberNewOrder(order);
  // After the response: the Payment, the confirmation and telling approvers (and again from the Subscription and the
  // sweep, which skip what is done).
  after(() => processOrder(placed.id));
  redirect(`/account/orders/${order.id}`);
}

// ---------- Card payments (consumers and guests) ----------

export type CardPaymentState = { error?: string; session?: CheckoutSession; reviewedCentAmount?: number };

// Public endpoint: opens a commercetools Checkout session for the caller's own B2C cart. Business buyers order on
// invoice instead. Consumers confirm their email first (an account can't order under someone else's address).
export async function startCardPayment(_prev: CardPaymentState, formData: FormData): Promise<CardPaymentState> {
  if (!checkoutPaymentsEnabled()) return { error: "Online payment is not available right now." };
  if (await isAutomated()) return { error: AUTOMATED_MESSAGE };
  const browse = await requireBrowseContext();
  const { session, auth, context, cartId } = browse;
  if (!auth || !cartId || !(context.consumer || context.guest)) return { error: "Your cart is no longer open." };
  if ((await tooManyAttempts(`pay:${actorKey(browse)}`, 20)) || (await tooManyAttempts(`pay-ip:${await clientIp()}`, 40))) {
    return { error: "Too many payment attempts. Please wait a few minutes and try again." };
  }
  if (context.consumer && session && !(await getMe(session)).isEmailVerified) {
    return { error: "Please confirm your email address first: use the link we sent you, or send a new one above." };
  }
  try {
    const prepared = await prepareCardPayment(auth, context, cartId, Number(formData.get("cartVersion")), session?.email);
    return { session: prepared.session, reviewedCentAmount: prepared.reviewedCentAmount };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof CheckoutError) return { error: err.message };
    console.error("card payment start failed", (err as { body?: unknown })?.body ?? (err as Error).message);
    return { error: "Online payment is unavailable right now. Please try again later." };
  }
}

// Public endpoint: the buyer cancels the card payment they opened, so their cart can change again. Only ever unlocks
// the caller's own cart, read with their own token.
export async function cancelCardPayment(): Promise<void> {
  const browse = await requireBrowseContext();
  const { auth, context, cartId } = browse;
  if (!auth || !cartId || !(context.consumer || context.guest)) return;
  if (await tooManyAttempts(`pay-cancel:${actorKey(browse)}`, 20)) return;
  try {
    await releaseCardPayment(auth, context, cartId);
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof CheckoutError) await flash("error", err.message);
    else console.error("card payment cancel failed", (err as { body?: unknown })?.body ?? err);
  }
  refreshPages();
}

// Public endpoint: called by the payment component once Checkout reports the order. Trusts nothing from the
// browser but the id: the order must be the caller's own and come from their current cart.
// `reviewedCentAmount`: the total the buyer saw when they opened the payment. The storefront refuses cart changes while
// the payment form is shown, but prices and discounts can still change; a different order total is flagged on the
// order page.
export async function finishCardPayment(orderId: string, reviewedCentAmount: number) {
  const { guest, auth, context, cartId } = await requireBrowseContext();
  if (!auth || !cartId) redirect("/cart");
  // The buyer has paid: an outage here must not look like "no order". The page tells them to wait, the Subscription
  // and the sweep do the rest.
  const order = await paidOrder(auth, context, orderId, cartId).catch((err) => {
    reportEvent("paid_order_unverified", err, { orderId });
    return undefined;
  });
  if (!order) redirect("/checkout?payment=unconfirmed");
  if (guest) await saveGuest({ ...guest, cartId: undefined });
  else (await cookies()).delete(cartCookie(context.businessUnitKey));
  refreshPages();
  await numberNewOrder(order);
  after(() => processOrder(order.id));
  after(() => clearPaymentLock(cartId).catch((err) => console.error("payment lock not removed", (err as { body?: unknown })?.body ?? err)));
  const total = order.taxedPrice?.totalGross.centAmount ?? order.totalPrice.centAmount;
  const changed = Number.isFinite(reviewedCentAmount) && total !== reviewedCentAmount ? "?changed=1" : "";
  redirect(guest ? `/order-confirmation/${order.id}${changed}` : `/account/orders/${order.id}${changed}`);
}

export type GuestDetailsState = { error?: string; saved?: boolean };
const EMAIL = /^[^\s@"\\]{1,64}@[^\s@"\\]{1,190}\.[A-Za-z]{2,}$/;

// Public endpoint: a guest's email, delivery address and method, saved on their own cart (anonymous token).
export async function saveGuestDetails(_prev: GuestDetailsState, formData: FormData): Promise<GuestDetailsState> {
  const browse = await requireBrowseContext();
  const { guest, context, cartId } = browse;
  if (!guest || !cartId) return { error: "Your cart is no longer open." };
  if (await isAutomated(formData)) return { error: AUTOMATED_MESSAGE };
  if (
    (await tooManyAttempts(`guest-details:${actorKey(browse)}`, 20)) ||
    (await tooManyAttempts(`guest-details-ip:${await clientIp()}`, 60))
  ) {
    return { error: "Too many changes. Please wait a few minutes and try again." };
  }
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  const parsed = parseAddress(formData, CONSUMER_COUNTRIES);
  if ("error" in parsed) return parsed;
  const cart = await getActiveCart(guest, cartId, context);
  if (!cart) return { error: "Your cart is no longer open." };
  try {
    await applyDelivery(guest, context, cart, {
      address: parsed.address,
      billing: parsed.address,
      email,
      shippingMethodKey: String(formData.get("shippingMethodKey") ?? ""),
    });
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof CheckoutError || err instanceof CartLockedError) return { error: err.message };
    console.error("guest checkout details failed", (err as { body?: unknown })?.body ?? err);
    return { error: "Your details could not be saved. Please try again." };
  }
  refreshPages();
  return { saved: true };
}

export type BillingState = { error?: string; saved?: boolean };

// Public endpoint: the billing address on a consumer's or guest's own cart (the payment step's billing section):
// the shipping address ("same"), one of the consumer's saved addresses ("saved:<id>", looked up on the server), or a
// new address. Business buyers are billed at their company's address and can't change it here.
export async function saveBillingAddress(_prev: BillingState, formData: FormData): Promise<BillingState> {
  const browse = await requireBrowseContext();
  const { session, auth, context, cartId } = browse;
  if (!auth || !cartId || !(context.consumer || context.guest)) return { error: "Your cart is no longer open." };
  if (await isAutomated(formData)) return { error: AUTOMATED_MESSAGE };
  if (await tooManyAttempts(`billing:${actorKey(browse)}`, 30)) {
    return { error: "Too many changes. Please wait a few minutes and try again." };
  }
  const cart = await getActiveCart(auth, cartId, context);
  if (!cart) return { error: "Your cart is no longer open." };
  if (!cart.shippingAddress) return { error: "Save your shipping address first." };
  const choice = String(formData.get("billing") ?? "");
  let address: BaseAddress | undefined;
  if (choice === "same") address = cart.shippingAddress;
  else if (choice.startsWith("saved:") && context.consumer && session) {
    const mine = await withMyAddresses(session, context);
    address = mine.addresses.find((a) => a.id && `saved:${a.id}` === choice);
  } else if (choice === "new") {
    const parsed = parseAddress(formData, CONSUMER_COUNTRIES);
    if ("error" in parsed) return parsed;
    address = parsed.address;
  }
  if (!address) return { error: "Choose a billing address." };
  try {
    await setBillingAddress(auth, context, cart, address);
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof CheckoutError || err instanceof CartLockedError) return { error: err.message };
    console.error("billing address failed", (err as { body?: unknown })?.body ?? err);
    return { error: "Your billing address could not be saved. Please try again." };
  }
  refreshPages();
  return { saved: true };
}

// ---------- Bank transfer (B2C fallback while card payments are switched off) ----------

export type BankTransferState = { error?: string };

// Public endpoint: places the consumer's or guest's own cart as an order to be paid by bank transfer. Business buyers use placeOrderAction (invoice + PO).
export async function placeBankTransferOrderAction(_prev: BankTransferState, formData: FormData): Promise<BankTransferState> {
  if (!bankTransferEnabled()) return { error: "Bank transfer is not available. Please choose another payment method." };
  if (await isAutomated()) return { error: AUTOMATED_MESSAGE };
  const browse = await requireBrowseContext();
  const { session, guest, auth, context, cartId } = browse;
  if (!auth || !cartId || !(context.consumer || context.guest)) return { error: "Your cart is no longer open." };
  if ((await tooManyAttempts(`order:${actorKey(browse)}`, 10)) || (await tooManyAttempts(`order-ip:${await clientIp()}`, 30))) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }
  if (context.consumer && session && !(await getMe(session)).isEmailVerified) {
    return { error: "Please confirm your email address first: use the link we sent you, or send a new one above." };
  }

  let placed: Order;
  try {
    placed = await placeBankTransferOrder(auth, context, cartId, Number(formData.get("cartVersion")), session?.email);
  } catch (err) {
    unstable_rethrow(err);
    revalidatePath("/checkout");
    if (err instanceof CheckoutError) return { error: err.message };
    console.error("bank transfer order failed", (err as { body?: unknown })?.body ?? err);
    return { error: orderErrorMessage(err) ?? "The order could not be placed. Please try again." };
  }

  if (guest) await saveGuest({ ...guest, cartId: undefined });
  else (await cookies()).delete(cartCookie(context.businessUnitKey));
  refreshPages();
  const orderId = placed.id;
  await numberNewOrder(placed);
  after(() => processOrder(orderId));
  redirect(guest ? `/order-confirmation/${orderId}` : `/account/orders/${orderId}`);
}
