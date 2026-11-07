import { expect, test } from "@playwright/test";
import { CART_LOCKED_MESSAGE } from "../../src/features/cart/payment-lock";
import { PAY_BUTTON, PART, addToCart, cartQuantity, fillGuestDetails, marker, offersCard, removeFromCart } from "./helpers";

// The card path with commercetools Checkout stubbed out: the browser can't reach Checkout, so no payment is taken
// and no order is created. What it checks is ours: opening a payment locks the cart (G5), the cart page says so and
// refuses changes, and "Cancel payment and change my cart" unlocks it. Needs card payments on (the default server);
// skipped when checkout offers bank transfer. Creates an anonymous cart and empties it again.

test("card payment: the cart is locked while a payment is open, and cancelling unlocks it", async ({ page }) => {
  // Everything the Checkout browser SDK talks to (its app, payment and connector hosts) fails.
  await page.route(/^https:\/\/[^/]*checkout[^/]*\.commercetools\.com\//, (route) => route.abort());

  await addToCart(page);
  try {
    await page.goto("/checkout");
    await fillGuestDetails(page, `${marker().toLowerCase()}@example.com`);
    test.skip(!(await offersCard(page)), "card payments are off (B2C_CARD_PAYMENTS=false)");
    await page.getByRole("button", { name: PAY_BUTTON }).click();

    const cancel = page.getByRole("button", { name: "Cancel payment and change my cart" });
    const failedToOpen = page.getByText(/could not|unavailable|try again/i).first();
    await expect(cancel.or(failedToOpen)).toBeVisible();

    if (!(await cancel.isVisible())) {
      // The server could not open a Checkout session (no Application for this origin, for example): the cart must
      // have stayed open.
      await page.goto("/cart");
      await expect(page.getByText(CART_LOCKED_MESSAGE).filter({ visible: true })).toHaveCount(0);
      test.info().annotations.push({ type: "note", description: "no Checkout session opened; only the unlocked cart was checked" });
      return;
    }

    // The session is open and the SDK can't load: the buyer is told, nothing is charged.
    await expect(page.getByText("Card payment is unavailable right now. Please try again later.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

    // The cart is locked: the cart page says so, and a change is refused.
    await page.goto("/cart");
    await expect(page.getByText(CART_LOCKED_MESSAGE)).toBeVisible();
    await page.goto(PART.slug);
    await page.getByRole("button", { name: "Add to cart" }).first().click();
    await expect(page.getByText(CART_LOCKED_MESSAGE)).toBeVisible();
    expect(await cartQuantity(page, PART.name)).toBe(1);

    // Cancelling at checkout unlocks it.
    await page.goto("/checkout");
    await expect(page.getByText("A payment is open for this cart")).toBeVisible();
    await page.getByRole("button", { name: "Cancel payment and change my cart" }).click();
    // The page reloads once the cart is unlocked ("Pay by card" shows on a locked cart too, so wait for the warning).
    await expect(page.getByText("A payment is open for this cart").filter({ visible: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: PAY_BUTTON })).toBeVisible();
    await page.goto("/cart");
    await expect(page.getByText(CART_LOCKED_MESSAGE).filter({ visible: true })).toHaveCount(0);
  } finally {
    // Unlock (if a step above failed while the payment was open), then empty the cart. A failure here must not hide
    // the test's own error.
    try {
      await page.goto("/checkout");
      const cancel = page.getByRole("button", { name: "Cancel payment and change my cart" });
      if (await cancel.isVisible()) {
        await cancel.click();
        await expect(page.getByText("A payment is open for this cart").filter({ visible: true })).toHaveCount(0);
      }
      await removeFromCart(page);
    } catch (err) {
      console.error("card test cleanup:", (err as Error).message);
    }
  }
});
