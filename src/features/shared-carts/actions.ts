"use server";

// Public endpoints for shared carts: the feature switch, a signed-in business context, a rate limit, input
// validation, then the service, which checks permissions live and only touches carts tied to the session.

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { tooManyAttempts } from "@/lib/rate-limit";
import { flash } from "@/lib/flash";
import { cartCookie, cookieOptions } from "@/features/auth/session";
import { requireBusinessContext } from "@/features/business-units/context";
import { CartLockedError } from "@/features/cart/payment-lock";
import { parseShareNote, sharedCartsEnabled } from "@/features/shared-carts/share";
import { SharedCartError, declineSharedCart, shareCart, takeOverSharedCart, withdrawShare } from "@/features/shared-carts/service";

export type ShareState = { error?: string; saved?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

async function start(bucket: string, max: number) {
  if (!sharedCartsEnabled()) return { error: "Sharing carts is not available." } as const;
  const current = await requireBusinessContext();
  if (await tooManyAttempts(`${bucket}:${current.session.customerId}`, max)) {
    return { error: "Too many attempts. Please wait a few minutes and try again." } as const;
  }
  return current;
}

const failed = (err: unknown, what: string): ShareState => {
  unstable_rethrow(err);
  if (err instanceof SharedCartError || err instanceof CartLockedError) return { error: err.message };
  console.error(`shared cart ${what} failed`, (err as { body?: unknown })?.body ?? err);
  return { error: "That didn't work. Please try again." };
};

export async function shareCartAction(_prev: ShareState, formData: FormData): Promise<ShareState> {
  const current = await start("cart-share", 20);
  if ("error" in current) return current;
  const reviewerId = text(formData, "reviewerId");
  if (!UUID.test(reviewerId)) return { error: "Choose a colleague." };
  const note = parseShareNote(text(formData, "note"));
  if (!note.ok) return { error: note.error };
  try {
    await shareCart(current.session, current.context, current.cartId, reviewerId, note.note);
  } catch (err) {
    return failed(err, "share");
  }
  refresh();
  return { saved: "You sent your cart for review. We emailed your colleague." };
}

export async function withdrawShareAction(): Promise<ShareState> {
  const current = await start("cart-share", 20);
  if ("error" in current) return current;
  try {
    await withdrawShare(current.session, current.context, current.cartId);
  } catch (err) {
    return failed(err, "withdraw");
  }
  refresh();
  return { saved: "Your cart is no longer shared." };
}

export async function takeOverSharedCartAction(_prev: ShareState, formData: FormData): Promise<ShareState> {
  const current = await start("cart-review", 30);
  if ("error" in current) return current;
  const cartId = text(formData, "cartId");
  if (!UUID.test(cartId)) return { error: "The form is out of date. Please reload." };
  try {
    const id = await takeOverSharedCart(current.session, current.context, cartId);
    (await cookies()).set(cartCookie(current.context.businessUnitKey), id, cookieOptions);
    await flash("success", "The cart is yours now: review it and check out.");
  } catch (err) {
    return failed(err, "take over");
  }
  redirect("/cart");
}

export async function declineSharedCartAction(_prev: ShareState, formData: FormData): Promise<ShareState> {
  const current = await start("cart-review", 30);
  if ("error" in current) return current;
  const cartId = text(formData, "cartId");
  if (!UUID.test(cartId)) return { error: "The form is out of date. Please reload." };
  const reason = parseShareNote(text(formData, "reason"));
  if (!reason.ok) return { error: reason.error };
  try {
    await declineSharedCart(current.session, current.context, cartId, reason.note);
  } catch (err) {
    return failed(err, "decline");
  }
  refresh();
  return { saved: "You sent the cart back." };
}
