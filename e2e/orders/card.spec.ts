import { expect, test } from "@playwright/test";
import { CART_LOCKED_MESSAGE } from "../../src/features/cart/payment-lock";
import { PART, addToCart, fillGuestDetails, marker, offersCard, removeFromCart } from "./helpers";

// The card path with commercetools Checkout stubbed out: the browser can't reach Checkout, so no payment is taken
// and no order is created. What it checks is ours: choosing card opens the payment on its own (no "Pay by card"
// click) with a soft lock, the buyer is told when Checkout can't load, and the cart stays open, because nobody pressed
// a pay button (features/cart/payment-lock.ts). Needs card payments on (the default server); skipped when checkout
// offers bank transfer. Creates an anonymous cart and empties it again.

test("card payment: choosing card opens the form on its own and leaves the cart open", async ({ page }) => {
  // Everything the Checkout browser SDK talks to (its app, payment and connector hosts) fails.
  await page.route(/^https:\/\/[^/]*checkout[^/]*\.commercetools\.com\//, (route) => route.abort());

  await addToCart(page);
  try {
    await page.goto("/checkout");
    await fillGuestDetails(page, `${marker().toLowerCase()}@example.com`);
    test.skip(!(await offersCard(page)), "card payments are off (B2C_CARD_PAYMENTS=false)");

    // Card is selected first: its form starts loading without a click, inside the card option.
    const body = page.getByRole("group", { name: "Credit or debit card" });
    const unavailable = page.getByRole("alert").getByText("Online payment is unavailable right now. Please try again later.");
    await expect(body.getByRole("status").or(unavailable)).toBeVisible();
    // Checkout can't load here: the buyer is told (in the page's message bar) and may try again; nothing is charged.
    await expect(unavailable).toBeVisible({ timeout: 30_000 });
    await expect(body.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel payment and change my cart" })).toHaveCount(0);

    // The lock is soft: the cart page doesn't call the cart locked, and the cart can still change.
    await page.goto("/cart");
    await expect(page.getByText(CART_LOCKED_MESSAGE).filter({ visible: true })).toHaveCount(0);
    await page.goto(PART.slug);
    await page.getByRole("button", { name: "Add to cart" }).first().click();
    await expect(page.getByText(CART_LOCKED_MESSAGE).filter({ visible: true })).toHaveCount(0);
  } finally {
    // Empty the cart. A failure here must not hide the test's own error.
    try {
      await removeFromCart(page);
    } catch (err) {
      console.error("card test cleanup:", (err as Error).message);
    }
  }
});
