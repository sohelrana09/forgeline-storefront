"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { hasBuyerRoleNow } from "@/features/business-units/service";
import { getActiveCart } from "@/features/cart/service";
import { applyCheckoutDetails, applyDelivery, CheckoutError, paidOrder, placeBankTransferOrder, placeOrder, prepareCardPayment } from "@/features/checkout/service";
import { approvalsForOrders, notifyApprovers } from "@/features/approvals/service";
import { cardPaymentsEnabled } from "@/lib/commercetools/checkout-session";
import type { CheckoutSession } from "@/lib/commercetools/checkout-session";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { parseAddress } from "@/features/account/utils";
import { CONSUMER_COUNTRIES } from "@/features/business-units/service";
import { cartCookie, saveGuest } from "@/features/auth/session";
import { requireBrowseContext, requireShopContext } from "@/features/business-units/context";
import { getMe, withMyAddresses } from "@/features/account/service";
import type { BuyerContext } from "@/features/business-units/types";
import type { Order } from "@commercetools/platform-sdk";
import { AUTOMATED_MESSAGE, isAutomated } from "@/lib/bot-check";

// Checkout has its own layout (route group "(checkout)"): refresh it as well as the shop pages (header cart, totals).
function refreshPages() {
  revalidatePath("/(shop)", "layout");
  revalidatePath("/(checkout)", "layout");
}

// Public endpoints: both act only on the signed-in customer's own open cart. In a business unit only buyers may
// use them (checked live); consumers always may, for their personal cart.
const mayOrder = async (context: BuyerContext, customerId: string) =>
  context.canOrder && (context.consumer || (await hasBuyerRoleNow(context.businessUnitKey, customerId)));

export type DeliveryState = { error?: string };

export async function chooseDelivery(_prev: DeliveryState, formData: FormData): Promise<DeliveryState> {
  const { session, context: selected, cartId } = await requireShopContext();
  if (!(await mayOrder(selected, session.customerId))) return { error: "Only buyers can place orders." };
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
    if (isRedirectError(err)) throw err; // signed out (revoked token)
    if (err instanceof CheckoutError) return { error: err.message };
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
  if (context.consumer) return { error: "Please pay by card." };

  let order: Order;
  try {
    order = await placeOrder(
      session,
      context,
      cartId,
      Number(formData.get("cartVersion")),
      // PO numbers are for business orders only.
      context.consumer ? "" : String(formData.get("purchaseOrderNumber") ?? "").trim(),
    );
  } catch (err) {
    if (isRedirectError(err)) throw err; // signed out (revoked token)
    // Re-render the page so the form carries the cart's current version (setting the PO may have bumped it).
    revalidatePath("/checkout");
    if (err instanceof CheckoutError) return { error: err.message };
    const body = (err as { body?: { statusCode?: number } })?.body;
    console.error("place order failed", body ?? err);
    if (body?.statusCode === 409) return { error: "Your cart changed. Please review it and place the order again." };
    return { error: "The order could not be placed. Please try again." };
  }

  (await cookies()).delete(cartCookie(context.businessUnitKey));
  refreshPages();
  // An order that matched an approval rule waits for an approver: tell them, after the response is sent.
  const placed = order;
  after(async () => {
    const approval = (await approvalsForOrders(context, session.customerId, [placed.id]))[placed.id];
    if (approval?.status === "Pending") await notifyApprovers(context, placed, approval);
  });
  redirect(`/account/orders/${order.id}`);
}

// ---------- Card payments (consumers and guests) ----------

export type CardPaymentState = { error?: string; session?: CheckoutSession; reviewedCentAmount?: number };

// Public endpoint: opens a commercetools Checkout session for the caller's own B2C cart. Business buyers order on
// invoice instead. Consumers confirm their email first (an account can't order under someone else's address).
export async function startCardPayment(_prev: CardPaymentState, formData: FormData): Promise<CardPaymentState> {
  if (!cardPaymentsEnabled()) return { error: "Card payments are not available right now." };
  if (await isAutomated()) return { error: AUTOMATED_MESSAGE };
  const { session, auth, context, cartId } = await requireBrowseContext();
  if (!auth || !cartId || !(context.consumer || context.guest)) return { error: "Your cart is no longer open." };
  if (await tooManyAttempts(`pay:${cartId}`, 20) || await tooManyAttempts(`pay-ip:${await clientIp()}`, 40)) {
    return { error: "Too many payment attempts. Please wait a few minutes and try again." };
  }
  if (context.consumer && session && !(await getMe(session)).isEmailVerified) {
    return { error: "Please confirm your email address first: use the link we sent you, or send a new one above." };
  }
  try {
    const prepared = await prepareCardPayment(auth, context, cartId, Number(formData.get("cartVersion")), session?.email);
    return { session: prepared.session, reviewedCentAmount: prepared.reviewedCentAmount };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof CheckoutError) return { error: err.message };
    console.error("card payment start failed", (err as { body?: unknown })?.body ?? (err as Error).message);
    return { error: "Card payment is unavailable right now. Please try again later." };
  }
}

// Public endpoint: called by the payment component once Checkout reports the order. Trusts nothing from the
// browser but the id: the order must be the caller's own and come from their current cart.
// `reviewedCentAmount`: the total the buyer saw when they clicked "Pay by card". The cart stays open while the
// payment form is shown (another tab could change it), so a different order total is flagged on the order page.
export async function finishCardPayment(orderId: string, reviewedCentAmount: number) {
  const { guest, auth, context, cartId } = await requireBrowseContext();
  if (!auth || !cartId) redirect("/cart");
  const order = await paidOrder(auth, context, orderId, cartId);
  if (!order) redirect("/checkout?payment=unconfirmed");
  if (guest) await saveGuest({ ...guest, cartId: undefined });
  else (await cookies()).delete(cartCookie(context.businessUnitKey));
  refreshPages();
  const total = order.taxedPrice?.totalGross.centAmount ?? order.totalPrice.centAmount;
  const changed = Number.isFinite(reviewedCentAmount) && total !== reviewedCentAmount ? "?changed=1" : "";
  redirect(guest ? `/order-confirmation/${order.id}${changed}` : `/account/orders/${order.id}${changed}`);
}

export type GuestDetailsState = { error?: string; saved?: boolean };
const EMAIL = /^[^\s@"\\]{1,64}@[^\s@"\\]{1,190}\.[A-Za-z]{2,}$/;

// Public endpoint: a guest's email, delivery address and method, saved on their own cart (anonymous token).
export async function saveGuestDetails(_prev: GuestDetailsState, formData: FormData): Promise<GuestDetailsState> {
  const { guest, context, cartId } = await requireBrowseContext();
  if (!guest || !cartId) return { error: "Your cart is no longer open." };
  if (await isAutomated(formData)) return { error: AUTOMATED_MESSAGE };
  if (await tooManyAttempts(`guest-details:${cartId}`, 20) || await tooManyAttempts(`guest-details-ip:${await clientIp()}`, 60)) {
    return { error: "Too many changes. Please wait a few minutes and try again." };
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
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
    if (isRedirectError(err)) throw err;
    if (err instanceof CheckoutError) return { error: err.message };
    console.error("guest checkout details failed", (err as { body?: unknown })?.body ?? err);
    return { error: "Your details could not be saved. Please try again." };
  }
  refreshPages();
  return { saved: true };
}

// ---------- Bank transfer (B2C fallback while card payments are switched off) ----------

export type BankTransferState = { error?: string };

// Public endpoint: places the consumer's or guest's own cart as an order to be paid by bank transfer. Only while card
// payments are off; business buyers use placeOrderAction (invoice + PO).
export async function placeBankTransferOrderAction(_prev: BankTransferState, formData: FormData): Promise<BankTransferState> {
  if (cardPaymentsEnabled()) return { error: "Please pay by card." };
  if (await isAutomated()) return { error: AUTOMATED_MESSAGE };
  const { session, guest, auth, context, cartId } = await requireBrowseContext();
  if (!auth || !cartId || !(context.consumer || context.guest)) return { error: "Your cart is no longer open." };
  if (await tooManyAttempts(`order:${cartId}`, 10) || await tooManyAttempts(`order-ip:${await clientIp()}`, 30)) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }
  if (context.consumer && session && !(await getMe(session)).isEmailVerified) {
    return { error: "Please confirm your email address first: use the link we sent you, or send a new one above." };
  }

  let orderId: string;
  try {
    const order = await placeBankTransferOrder(auth, context, cartId, Number(formData.get("cartVersion")), session?.email);
    orderId = order.id;
  } catch (err) {
    if (isRedirectError(err)) throw err;
    revalidatePath("/checkout");
    if (err instanceof CheckoutError) return { error: err.message };
    const body = (err as { body?: { statusCode?: number } })?.body;
    console.error("bank transfer order failed", body ?? err);
    if (body?.statusCode === 409) return { error: "Your cart changed. Please review it and place the order again." };
    return { error: "The order could not be placed. Please try again." };
  }

  if (guest) await saveGuest({ ...guest, cartId: undefined });
  else (await cookies()).delete(cartCookie(context.businessUnitKey));
  refreshPages();
  redirect(guest ? `/order-confirmation/${orderId}` : `/account/orders/${orderId}`);
}
