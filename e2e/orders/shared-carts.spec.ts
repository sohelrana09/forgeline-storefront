import { expect, test } from "@playwright/test";
import { ACCOUNTS, stateFile } from "../signed-in/accounts";
import { cleanupProblem, createTestCart, deleteTestCart } from "./cleanup";
import { PART, addToCart, useCart } from "./helpers";

// Shared carts (docs/features/shared-carts.md). Needs a server with SHARED_CARTS=true, the share fields on the order
// Type (ct:order-approval-type -- --yes) and an approver who may order (ct:seed-cart-review-permissions -- --yes);
// set E2E_SHARED_CARTS=1 to run. The buyer sends a fresh test cart to the approver, who sends it back or takes it
// over; the test cart is deleted afterwards whoever holds it. Nothing is ordered.

const UNIT = "lifttech-solutions-ltd-es";
const APPROVER = /Carlos/;

test.use({ storageState: stateFile("buyer") });

let cartId = "";

test.beforeAll(async () => {
  test.skip(process.env.E2E_SHARED_CARTS !== "1", "E2E_SHARED_CARTS=1 (server with SHARED_CARTS=true) not set");
  test.skip(!(process.env.E2E_PASSWORD ?? process.env.DEMO_BUYER_PASSWORD), "no demo password for the signed-in tests");
  const problem = await cleanupProblem();
  test.skip(!!problem, `Order tests can't clean up: ${problem}`);
});

test.beforeEach(async ({ page }) => {
  cartId = await createTestCart(ACCOUNTS.buyer, UNIT);
  await useCart(page, UNIT, cartId);
  await addToCart(page, PART);
  await page.goto("/cart");
  await page.getByText("Send to a colleague for review").click();
  const colleague = page.getByLabel("Colleague");
  await colleague.selectOption((await colleague.locator("option", { hasText: APPROVER }).first().getAttribute("value")) ?? "");
  await page.getByLabel("Note (optional)").fill("E2E test, please ignore");
  await page.getByRole("button", { name: "Send for review" }).click();
  await expect(page.getByText("You sent your cart for review.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Shared for review" })).toContainText("Carlos");
});

test.afterEach(async () => {
  if (cartId) await deleteTestCart(cartId).catch(() => undefined);
  cartId = "";
});

test("the approver sees the cart and sends it back", async ({ browser }) => {
  const approver = await browser.newContext({ storageState: stateFile("approver") });
  try {
    const p = await approver.newPage();
    await p.goto("/account/shared-carts");
    const card = p.getByRole("region", { name: /^Cart from / }).filter({ hasText: "E2E test, please ignore" });
    await expect(card).toContainText(PART.name);
    await card.getByText(/^Send it back to /).click();
    await card.getByLabel(/^Reason/).fill("E2E: sent back on purpose");
    await card.getByRole("button", { name: "Send back" }).click();
    await expect(p.getByText("You sent the cart back.")).toBeVisible();
  } finally {
    await approver.close();
  }
});

test("the approver takes the cart over and finds it as their own cart", async ({ browser, page }) => {
  const approver = await browser.newContext({ storageState: stateFile("approver") });
  try {
    const p = await approver.newPage();
    await p.goto("/account/shared-carts");
    const card = p.getByRole("region", { name: /^Cart from / }).filter({ hasText: "E2E test, please ignore" });
    await card.getByRole("button", { name: "Take over to edit and order" }).click();
    await p.waitForURL(/\/cart$/);
    await expect(p.getByText("The cart is yours now: review it and check out.")).toBeVisible();
    await expect(p.getByRole("region", { name: "Cart lines" })).toContainText(PART.name);
  } finally {
    await approver.close();
  }
  // The buyer's cookie still names the cart, but it is no longer hers.
  await page.goto("/cart");
  await expect(page.getByRole("region", { name: "Shared for review" })).toHaveCount(0);
});
