"use server";

// Public endpoints for quotes. Each one works only for a signed-in buyer, on their own records in the selected
// business unit; the service re-reads every record with the buyer's token before changing it.

import { after } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath, refresh } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { cartCookie } from "@/features/auth/session";
import { requireBusinessContext } from "@/features/business-units/context";
import { notifyApproversIfPending } from "@/features/approvals/service";
import { numberNewOrder, processOrder } from "@/features/order-processing/service";
import { tooManyAttempts } from "@/lib/rate-limit";
import { outOfStockSkus } from "@/features/cart/stock";
import {
  QuoteError,
  cancelQuoteRequest,
  createQuoteRequest,
  declineQuote,
  orderFromQuote,
  renegotiateQuote,
} from "@/features/quotes/service";
import type { QuoteActionState } from "@/features/quotes/types";

const str = (formData: FormData, name: string) => String(formData.get(name) ?? "");

// Maps service errors to a message; anything unexpected is logged and shown generically.
function failed(err: unknown, fallback: string): QuoteActionState {
  unstable_rethrow(err);
  if (err instanceof QuoteError) return { error: err.message };
  const skus = outOfStockSkus(err); // G6: the quote's lines can't be filled from stock right now
  if (skus)
    return { error: `Not enough stock${skus.length ? ` for ${skus.join(", ")}` : ""} to order this quote right now. Please contact us.` };
  const body = (err as { body?: { statusCode?: number } })?.body;
  console.error(fallback, body ?? err);
  if (body?.statusCode === 409) return { error: "This changed in the meantime. Please review it and try again." };
  return { error: `${fallback} Please try again.` };
}

export async function requestQuote(_prev: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  const { session, context, cartId } = await requireBusinessContext();
  if (!context.canOrder || !cartId) return { error: "Only buyers with an open cart can request quotes." };
  let requestId: string;
  try {
    const request = await createQuoteRequest(session, context, cartId, Number(str(formData, "cartVersion")), str(formData, "comment"));
    requestId = request.id;
  } catch (err) {
    return failed(err, "The quote request could not be sent.");
  }
  // The source cart stays Active in commercetools: forget it so it can't be submitted twice.
  (await cookies()).delete(cartCookie(context.businessUnitKey));
  refresh();
  redirect(`/account/quotes/requests/${requestId}`);
}

export async function cancelRequest(_prev: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  const { session, context } = await requireBusinessContext();
  if (!context.canOrder) return { error: "Only buyers can cancel quote requests." };
  try {
    await cancelQuoteRequest(session, context, str(formData, "id"));
  } catch (err) {
    return failed(err, "The request could not be cancelled.");
  }
  revalidatePath("/account/quotes", "layout");
  return {};
}

export async function decline(_prev: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  const { session, context } = await requireBusinessContext();
  if (!context.canOrder) return { error: "Only buyers can decline quotes." };
  try {
    await declineQuote(session, context, str(formData, "id"), Number(str(formData, "version")));
  } catch (err) {
    return failed(err, "The quote could not be declined.");
  }
  revalidatePath("/account/quotes", "layout");
  return {};
}

export async function renegotiate(_prev: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  const { session, context } = await requireBusinessContext();
  if (!context.canOrder) return { error: "Only buyers can renegotiate quotes." };
  try {
    await renegotiateQuote(session, context, str(formData, "id"), Number(str(formData, "version")), str(formData, "comment"));
  } catch (err) {
    return failed(err, "The renegotiation request could not be sent.");
  }
  revalidatePath("/account/quotes", "layout");
  return {};
}

export async function acceptAndOrder(_prev: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  const { session, context } = await requireBusinessContext();
  if (!context.canOrder) return { error: "Only buyers can accept quotes." };
  // G8: per quote and per buyer (shared with placing orders from the cart), like the other order actions.
  if (
    (await tooManyAttempts(`quote-order:${str(formData, "id").slice(0, 64)}`, 10)) ||
    (await tooManyAttempts(`order-customer:${session.customerId}`, 30))
  ) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }
  let target: string;
  try {
    const { order, poSaved } = await orderFromQuote(
      session,
      context,
      str(formData, "id"),
      Number(str(formData, "version")),
      str(formData, "purchaseOrderNumber"),
    );
    target = `/account/orders/${order.id}${poSaved ? "" : "?po=failed"}`;
    const placed = await numberNewOrder(order);
    after(async () => {
      await processOrder(placed.id); // never throws
      await notifyApproversIfPending(context, session.customerId, placed);
    });
  } catch (err) {
    return failed(err, "The order could not be placed.");
  }
  refresh();
  redirect(target);
}
