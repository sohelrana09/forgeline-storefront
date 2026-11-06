import { expect, test } from "@playwright/test";
import { ACCOUNTS, stateFile } from "../signed-in/accounts";
import { cancelTestOrder, cleanupProblem, createTestCart, deleteTestCart, readOrder, waitForOrder } from "./cleanup";
import { ORDER_NUMBER, PART, addToCart, chooseDelivery, marker, placeOrder, useCart } from "./helpers";

// The demo company's buyer (LiftTech Soluciones S.L., Spain) orders on invoice with a PO number, and once more above
// the unit's approval rule ("Orders over €10,000", npm run ct:seed-approval-rules), which the approver rejects.
// Needs the signed-in sessions (E2E_PASSWORD or .env.demo). Each test orders from a fresh cart it creates for the
// buyer (createTestCart + the cart cookie), so her own carts are never touched; the storefront would otherwise fall
// back to her latest open cart. Orders are cancelled and their stock given back, the test cart deleted if unused.
// The orders project runs with a single worker, so the two tests run one after the other.

const UNIT = "lifttech-solutions-ltd-es";
const AIR_FILTER = { slug: "/air-filter", name: "Air Filter" };
const ABOVE_RULE = 400; // Air Filters: well above €10,000 at the Spanish unit's price

test.use({ storageState: stateFile("buyer") });

let cartId = "";
let orderId = "";

test.beforeAll(async () => {
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

test("invoice order with a PO number: order number, pending invoice Payment", async ({ page }) => {
  await addToCart(page, PART);
  await page.goto("/checkout");
  test.skip(!(await chooseDelivery(page)), "the buyer has no shipping address");
  const po = marker();
  await page.getByLabel("Purchase order number (optional)").fill(po);
  orderId = await placeOrder(page);

  await expect(page.getByRole("heading", { level: 1 })).toContainText(ORDER_NUMBER);
  await expect(page.getByRole("main")).toContainText(`Purchase order: ${po}`);
  const order = await waitForOrder(orderId, (o) => (o.paymentInfo?.payments.length ?? 0) > 0);
  expect(order.cart?.id, "ordered from the test cart").toBe(cartId);
  expect(order.orderNumber).toMatch(ORDER_NUMBER);
  expect(order.paymentInfo?.payments.length, "Payment linked (runtime client needs manage_payments)").toBe(1);
  expect(order.paymentState).toBe("Pending");
});

test("an order above the approval rule waits, and the approver's rejection cancels it", async ({ page, browser }) => {
  await addToCart(page, AIR_FILTER, ABOVE_RULE);
  await page.goto("/checkout");
  test.skip(!(await chooseDelivery(page)), "the buyer has no shipping address");
  await page.getByLabel("Purchase order number (optional)").fill(marker());
  orderId = await placeOrder(page);

  const approval = page.getByRole("region", { name: "Approval" });
  await expect(approval).toContainText("Orders over €10,000");
  await expect(approval).toContainText("needs approval before it is processed");
  const placed = await readOrder(orderId);
  expect(placed.cart?.id, "ordered from the test cart").toBe(cartId);
  const number = placed.orderNumber!;
  expect(number).toMatch(ORDER_NUMBER);
  // The invoice Payment is linked (after the response) before the approver decides.
  const linked = await waitForOrder(orderId, (o) => o.paymentState === "Pending");
  expect(linked.paymentState, "Payment linked (runtime client needs manage_payments)").toBe("Pending");

  // The approver rejects it in their own session.
  const approver = await browser.newContext({ storageState: stateFile("approver") });
  try {
    const p = await approver.newPage();
    await p.goto("/account/approvals");
    await p.getByRole("link", { name: `Review order ${number}` }).click();
    await p.waitForURL(/\/account\/approvals\/[0-9a-f-]{36}$/);
    await p.getByRole("button", { name: "Reject…" }).click();
    await p.getByLabel("Reason for rejecting (the buyer sees it)").fill("E2E test: rejected on purpose.");
    await p.getByRole("button", { name: "Reject order" }).click();
    await expect(p.getByText(/^Rejected by .+ on .+:/)).toBeVisible();
  } finally {
    await approver.close();
  }

  // Our code cancels a rejected order.
  const order = await waitForOrder(orderId, (o) => o.orderState === "Cancelled");
  expect(order.orderState).toBe("Cancelled");
  // Nobody waits for its money any more: the order's payment state and our Payment say so.
  expect(order.paymentState).toBe("Failed");
  expect(order.paymentInfo?.payments[0]?.obj?.paymentStatus?.interfaceCode).toBe("cancelled");
  await page.reload();
  await expect(page.getByRole("region", { name: "Approval" })).toContainText("Rejected");
});
