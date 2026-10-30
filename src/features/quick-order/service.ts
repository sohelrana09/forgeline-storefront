import "server-only";
import { cookies } from "next/headers";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { refresh } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requestAnonymousToken } from "@/lib/commercetools/customer-token";
import { cartCookie, cookieOptions, guestScopes, saveGuest } from "@/features/auth/session";
import { currentBrowseContext } from "@/features/business-units/context";
import { addLinesToCart, lookupSkus } from "@/features/cart/service";
import { parseQuickOrder } from "@/features/quick-order/parser";
import type { QuickOrderState } from "@/features/quick-order/types";

const fail = (reason: string, submitted?: string): QuickOrderState => ({
  added: [],
  errors: [{ line: 0, text: "", reason }],
  submitted,
});

// Parses "SKU, qty" lines, prices them for the selected unit and adds the orderable ones to its cart in one update.
// Used by the quick-order form and by every "Add to cart" button (one line). Guests get a guest cart.
export async function addParsedLines(input: string): Promise<QuickOrderState> {
  const current = await currentBrowseContext();
  if (!current) return fail("Your account is not an associate of any business unit.", input);
  const { context, cartId } = current;
  if (!context.canOrder) return fail(`You don't have the buyer role in ${context.businessUnitName}.`, input);

  const { lines, errors } = parseQuickOrder(input);
  if (lines.length === 0) {
    return {
      added: [],
      errors: errors.length ? errors : [{ line: 0, text: "", reason: "Enter at least one SKU" }],
      submitted: input,
    };
  }

  const skus = await lookupSkus(
    context,
    lines.map((l) => l.sku),
  );
  // Consumers can't request quotes, so machines (quote only) can't go into their cart.
  const quoteBlocked = (sku: string) => Boolean(context.consumer && skus.get(sku)?.quoteOnly);
  const addable = lines.filter((l) => skus.get(l.sku)?.priced && !quoteBlocked(l.sku));
  for (const l of lines) {
    const info = skus.get(l.sku);
    const text = `${l.sku}, ${l.quantity}`;
    if (!info) errors.push({ line: 0, text, reason: `Unknown SKU for ${context.storeName}` });
    else if (quoteBlocked(l.sku)) errors.push({ line: 0, text, reason: "Sold to business customers on quote" });
    else if (!info.priced)
      errors.push({
        line: 0,
        text,
        reason: `No ${context.currency} price for ${context.guest ? context.storeName : context.businessUnitName}`,
      });
  }
  if (addable.length === 0) return { added: [], errors, submitted: input };

  try {
    if (current.session) {
      const cart = await addLinesToCart(current.session, cartId, context, addable);
      (await cookies()).set(cartCookie(context.businessUnitKey), cart.id, cookieOptions);
    } else {
      // A guest's first line creates their anonymous token; the cart id travels in the sealed guest cookie.
      // Each new guest is a token and a cart in the project: throttle per IP so a cookie-less script can't pile them up.
      if (!current.guest && (await tooManyAttempts(`guest-cart:${await clientIp()}`, 30))) {
        return fail("Too many new carts from your network. Please wait a few minutes and try again.", input);
      }
      const guest = current.guest ?? (await requestAnonymousToken(guestScopes(context.storeKey)));
      if (!guest) throw new Error("anonymous token unavailable");
      const cart = await addLinesToCart(guest, cartId, context, addable);
      await saveGuest({ ...guest, cartId: cart.id });
    }
  } catch (err) {
    // signOutOnAuthError's redirect must not be swallowed here (a revoked token would loop "try again").
    if (isRedirectError(err)) throw err;
    // Log the details server-side; the browser only gets a generic reason.
    console.error("quick order failed", (err as { body?: unknown })?.body ?? err);
    return {
      added: [],
      errors: [...errors, { line: 0, text: "", reason: "The cart could not be updated. Please try again." }],
      submitted: input,
    };
  }

  refresh();
  return {
    added: addable.map((l) => ({ ...l, name: skus.get(l.sku)!.name, quoteOnly: Boolean(skus.get(l.sku)!.quoteOnly) })),
    errors,
    // Keep only the lines that failed in the box, so the buyer can fix them.
    submitted: errors
      .map((e) => e.text)
      .filter(Boolean)
      .join("\n"),
  };
}
