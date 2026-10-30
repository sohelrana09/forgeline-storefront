"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getActiveCart, setLineQuantity } from "@/features/cart/service";
import { localize } from "@/features/catalog/utils";
import { requireBrowseContext } from "@/features/business-units/context";
import { addParsedLines } from "@/features/quick-order/service";
import { flash } from "@/lib/flash";
import { cartCookie, cookieOptions } from "@/features/auth/session";

// Public endpoint: one "Add to cart" button (single SKU line).
export async function addSku(formData: FormData) {
  const sku = String(formData.get("sku") ?? "");
  const quantity = Number(formData.get("quantity") || 1);
  // Build exactly one line from validated parts so form data can't inject extra lines.
  if (!/^[A-Za-z0-9._-]+$/.test(sku) || !Number.isInteger(quantity)) return;
  const result = await addParsedLines(`${sku}, ${quantity}`);
  // Page messages: "You added X to your shopping cart." or why it wasn't added.
  for (const line of result.added) {
    await flash(
      "success",
      line.quoteOnly ? `You added ${line.name} to your cart for a quote.` : `You added ${line.name} to your shopping cart.`,
    );
  }
  for (const error of result.errors) await flash("error", `${error.reason}.`.replace(/\.\.$/, "."));
}

// Public endpoint: a signed-in buyer on a new device has no cart cookie (or a stale one), so every page looked up their
// latest open cart again (getActiveCart; Server Components can't set cookies). The minicart calls this once to save
// it. Takes no argument: it repeats that lookup with the buyer's own token and saves only what it finds.
export async function rememberCart() {
  const { session, auth, context, cartId } = await requireBrowseContext();
  if (!session || !auth) return;
  const cart = await getActiveCart(auth, cartId, context);
  if (cart && cart.id !== cartId) (await cookies()).set(cartCookie(context.businessUnitKey), cart.id, cookieOptions);
}

// Public endpoint: only ever touches the caller's own open cart (the buyer's for the selected unit, or the guest's).
export async function updateCartLine(formData: FormData) {
  const { auth, context, cartId } = await requireBrowseContext();
  if (!context.canOrder || !auth) return;
  const cart = await getActiveCart(auth, cartId, context);
  if (!cart) return;

  const lineItemId = String(formData.get("lineItemId") ?? "");
  const quantity = formData.get("intent") === "remove" ? 0 : Number(formData.get("quantity"));
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 9999) {
    await flash("error", "Enter a quantity from 1 to 9999.");
    return;
  }
  const line = cart.lineItems.find((l) => l.id === lineItemId);

  try {
    await setLineQuantity(auth, context, cart, lineItemId, quantity);
    // Removing says so; a changed quantity speaks for itself.
    if (quantity === 0 && line) await flash("success", `You removed ${localize(line.name)} from your shopping cart.`);
  } catch (err) {
    if (isRedirectError(err)) throw err; // signed out (revoked token)
    console.error("cart update failed", (err as { body?: unknown })?.body ?? err);
    await flash("error", "We couldn't update your shopping cart. Please try again.");
  }
  refresh();
}
