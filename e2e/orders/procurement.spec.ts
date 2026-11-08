import { expect, test } from "@playwright/test";
import { ACCOUNTS, stateFile } from "../signed-in/accounts";
import { cancelTestOrder, cleanupProblem, createTestCart, deleteTestCart, readOrder } from "./cleanup";
import { PART, addToCart, chooseDelivery, marker, placeOrder, useCart } from "./helpers";

// Procurement fields at business checkout (docs/features/procurement-checkout.md). Needs a server with
// PROCUREMENT_FIELDS=true and the fields on the order Type (npm run ct:order-approval-type -- --yes); set
// E2E_PROCUREMENT=1 to run. Like business.spec.ts, each test orders from a fresh cart it creates for the buyer; the
// order is cancelled and its stock given back, the cart deleted if unused.

const UNIT = "lifttech-solutions-ltd-es";

test.use({ storageState: stateFile("buyer") });

let cartId = "";
let orderId = "";

test.beforeAll(async () => {
  test.skip(process.env.E2E_PROCUREMENT !== "1", "E2E_PROCUREMENT=1 (server with PROCUREMENT_FIELDS=true) not set");
  test.skip(!(process.env.E2E_PASSWORD ?? process.env.DEMO_BUYER_PASSWORD), "no demo password for the signed-in tests");
  const problem = await cleanupProblem();
  test.skip(!!problem, `Order tests can't clean up: ${problem}`);
});

test.beforeEach(async ({ page }) => {
  cartId = await createTestCart(ACCOUNTS.buyer, UNIT);
  await useCart(page, UNIT, cartId);
});

test.afterEach(async () => {
  if (orderId) await cancelTestOrder(orderId);
  if (cartId) await deleteTestCart(cartId);
  orderId = cartId = "";
});

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

test("a delivery date in the past is refused before anything is ordered", async ({ page }) => {
  await addToCart(page, PART);
  await page.goto("/checkout");
  test.skip(!(await chooseDelivery(page)), "the buyer has no shipping address");
  const date = page.getByLabel("Requested delivery date");
  // The browser's min stops a typed past date; take it off to reach the server's own check.
  await date.evaluate((el) => el.removeAttribute("min"));
  await date.fill(inDays(-3));
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByText("Requested delivery date: choose a day from tomorrow up to one year ahead.")).toBeVisible();
  await expect(page).toHaveURL(/\/checkout$/);
});

test("cost centre, project code, date and note reach the order, its page and its PDF", async ({ page }) => {
  await addToCart(page, PART);
  await page.goto("/checkout");
  test.skip(!(await chooseDelivery(page)), "the buyer has no shipping address");
  const code = marker();
  const day = inDays(14);
  await page.getByLabel("Cost centre").fill("CC-4100");
  await page.getByLabel("Project code").fill(code);
  await page.getByLabel("Requested delivery date").fill(day);
  await page.getByLabel("Order note").fill("Gate 4\nCall the site office first");
  orderId = await placeOrder(page);

  const details = page.getByRole("main");
  await expect(details).toContainText("Cost centre: CC-4100");
  await expect(details).toContainText(`Project code: ${code}`);
  await expect(details).toContainText("Call the site office first");

  const order = await readOrder(orderId);
  expect(order.custom?.fields).toMatchObject({ costCentre: "CC-4100", projectCode: code, requestedDeliveryDate: day });

  const pdf = await page.request.get(`/account/orders/${orderId}/pdf/confirmation`);
  expect(pdf.ok()).toBe(true);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});
