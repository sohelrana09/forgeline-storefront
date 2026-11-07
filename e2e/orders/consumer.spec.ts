import { expect, test } from "@playwright/test";
import { cancelTestOrder, cleanupProblem, waitForOrder } from "./cleanup";
import { ORDER_NUMBER, addToCart, cartIsEmpty, chooseDelivery, offersCard, placeOrder, removeFromCart } from "./helpers";

// A signed-in consumer (no business unit) orders and pays by bank transfer. The project has no demo consumer, so
// this runs only with E2E_CONSUMER_EMAIL and E2E_CONSUMER_PASSWORD (a confirmed account with a saved address, in
// the B2C store) and with card payments off. The order is cancelled and its stock given back afterwards.

const email = process.env.E2E_CONSUMER_EMAIL;
const password = process.env.E2E_CONSUMER_PASSWORD;
let orderId = "";

test.beforeAll(async () => {
  test.skip(!email || !password, "set E2E_CONSUMER_EMAIL and E2E_CONSUMER_PASSWORD for the consumer order test");
  const problem = await cleanupProblem();
  test.skip(!!problem, `Order tests can't clean up: ${problem}`);
});

test.afterEach(async () => {
  if (orderId) await cancelTestOrder(orderId);
  orderId = "";
});

test("consumer bank transfer: order number, pending Payment, order page", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.waitForTimeout(1700);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Sign out" }).waitFor();

  // Ordering takes the whole cart: only run on an empty one, so nothing of the account holder's is ordered.
  test.skip(!(await cartIsEmpty(page)), "the consumer's cart isn't empty");
  await addToCart(page);
  await page.goto("/checkout");
  if (!(await chooseDelivery(page))) {
    await removeFromCart(page);
    test.skip(true, "the consumer has no saved address");
  }
  if (await offersCard(page)) {
    await removeFromCart(page);
    test.skip(true, "card payments are on: start the server with B2C_CARD_PAYMENTS=false and B2C_BANK_TRANSFER=true");
  }
  orderId = await placeOrder(page);

  await expect(page.getByRole("heading", { level: 1 })).toContainText(ORDER_NUMBER);
  const order = await waitForOrder(orderId, (o) => (o.paymentInfo?.payments.length ?? 0) > 0);
  expect(order.orderNumber).toMatch(ORDER_NUMBER);
  expect(order.paymentInfo?.payments.length, "Payment linked (runtime client needs manage_payments)").toBe(1);
  expect(order.paymentState).toBe("Pending");
});
