import { expect, test } from "@playwright/test";
import { cancelTestOrder, cleanupProblem, waitForOrder } from "./cleanup";
import { ORDER_NUMBER, addToCart, fillGuestDetails, marker, offersCard, placeOrder, removeFromCart } from "./helpers";

// A guest orders a spare part and pays by bank transfer. Needs the server with card payments off
// (B2C_CARD_PAYMENTS=false, launch config next-dev-bank-transfer); skipped when checkout offers a card.
// Creates an anonymous cart and an order; the order is cancelled and its stock given back afterwards.

let orderId = "";

test.beforeAll(async () => {
  const problem = await cleanupProblem();
  test.skip(!!problem, `Order tests can't clean up: ${problem}`);
});

test.afterEach(async () => {
  if (orderId) await cancelTestOrder(orderId);
  orderId = "";
});

test("guest bank transfer: order number, pending Payment, confirmation page", async ({ page }) => {
  await addToCart(page);
  await page.goto("/checkout");

  const email = `${marker().toLowerCase()}@example.com`;
  await fillGuestDetails(page, email);
  if (await offersCard(page)) {
    await removeFromCart(page);
    test.skip(true, "card payments are on: start the server with B2C_CARD_PAYMENTS=false");
  }
  orderId = await placeOrder(page);

  const main = page.getByRole("main");
  await expect(main).toContainText(ORDER_NUMBER);
  await expect(main).toContainText("to pay by bank transfer");
  await expect(main).toContainText(email);

  // The order number is set before the page shows; the Payment comes from after() (needs manage_payments).
  const order = await waitForOrder(orderId, (o) => (o.paymentInfo?.payments.length ?? 0) > 0);
  expect(order.orderNumber).toMatch(ORDER_NUMBER);
  expect(order.paymentInfo?.payments.length, "Payment linked (runtime client needs manage_payments)").toBe(1);
  expect(order.paymentState).toBe("Pending");
});
