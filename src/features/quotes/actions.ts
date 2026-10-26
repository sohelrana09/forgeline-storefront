"use server";

// Public endpoints for quotes. Each one works only for a signed-in buyer, on their own records in the selected
// business unit; the service re-reads every record with the buyer's token before changing it.

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { cartCookie } from "@/features/auth/session";
import { requireBusinessContext } from "@/features/business-units/context";
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
  if (isRedirectError(err)) throw err;
  if (err instanceof QuoteError) return { error: err.message };
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
  revalidatePath("/(shop)", "layout");
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
  } catch (err) {
    return failed(err, "The order could not be placed.");
  }
  revalidatePath("/(shop)", "layout");
  redirect(target);
}
