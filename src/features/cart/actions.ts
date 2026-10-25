"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getActiveCart, setLineQuantity } from "@/features/cart/service";
import { requireBrowseContext } from "@/features/business-units/context";
import { addParsedLines } from "@/features/quick-order/service";

// Public endpoint: one "Add to cart" button (single SKU line).
export async function addSku(formData: FormData) {
  const sku = String(formData.get("sku") ?? "");
  const quantity = Number(formData.get("quantity") || 1);
  // Build exactly one line from validated parts so form data can't inject extra lines.
  if (!/^[A-Za-z0-9._-]+$/.test(sku) || !Number.isInteger(quantity)) return;
  await addParsedLines(`${sku}, ${quantity}`);
}

// Public endpoint: only ever touches the caller's own open cart (the buyer's for the selected unit, or the guest's).
export async function updateCartLine(formData: FormData) {
  const { auth, context, cartId } = await requireBrowseContext();
  if (!context.canOrder || !auth) return;
  const cart = await getActiveCart(auth, cartId, context);
  if (!cart) return;

  const lineItemId = String(formData.get("lineItemId") ?? "");
  const quantity = formData.get("intent") === "remove" ? 0 : Number(formData.get("quantity"));
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 9999) return;

  try {
    await setLineQuantity(auth, context, cart, lineItemId, quantity);
  } catch (err) {
    if (isRedirectError(err)) throw err; // signed out (revoked token)
    console.error("cart update failed", (err as { body?: unknown })?.body ?? err);
  }
  revalidatePath("/(shop)", "layout");
}
