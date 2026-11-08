import { expect, test } from "@playwright/test";
import { ACCOUNTS, stateFile } from "../signed-in/accounts";
import { cleanupProblem, customerIdByEmail, deleteTestRecurringOrder, recurringOrdersOf } from "./cleanup";

// Recurring orders (docs/features/recurring-orders.md). Needs a server with RECURRING_ORDERS=true and a runtime client
// with manage_recurring_orders; set E2E_RECURRING=1 to run. The buyer repeats one of her past orders with the first
// run a month ahead (so nothing is ordered), pauses and cancels it. Every recurring order the test created is
// deleted afterwards with its cart, also when a step fails; ones she had before stay untouched.

test.use({ storageState: stateFile("buyer") });

let customerId = "";
let before = new Set<string>();

test.beforeAll(async () => {
  test.skip(process.env.E2E_RECURRING !== "1", "E2E_RECURRING=1 (server with RECURRING_ORDERS=true) not set");
  test.skip(!(process.env.E2E_PASSWORD ?? process.env.DEMO_BUYER_PASSWORD), "no demo password for the signed-in tests");
  const problem = await cleanupProblem();
  test.skip(!!problem, `Order tests can't clean up: ${problem}`);
  customerId = await customerIdByEmail(ACCOUNTS.buyer);
  before = new Set((await recurringOrdersOf(customerId)).map((r) => r.id));
});

test.afterEach(async () => {
  if (!customerId) return;
  for (const r of await recurringOrdersOf(customerId)) if (!before.has(r.id)) await deleteTestRecurringOrder(r.id);
});

test("repeat a past order, then pause and cancel it", async ({ page }) => {
  await page.goto("/account/orders");
  const first = page
    .getByRole("main")
    .getByRole("link", { name: /ORD-|[A-Z0-9]+-\d{4}-\d{6}/ })
    .first();
  test.skip(!(await first.count()), "the buyer has no orders to repeat");
  await first.click();
  await page.waitForURL(/\/account\/orders\/[0-9a-f-]{36}$/);

  await page.getByText("Repeat this order on a schedule").click();
  await page.getByLabel("First order on").fill(new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Set up recurring order" }).click();
  await page.waitForURL(/\/account\/recurring-orders$/);
  await expect(page.getByText(/You set up a recurring order from order/)).toBeVisible();

  const card = page.getByRole("region", { name: /^Recurring order/ }).first();
  await expect(card).toContainText("Active");
  await card.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByText("You paused the recurring order.")).toBeVisible();
  await expect(card).toContainText("Paused");

  page.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("You cancelled the recurring order.")).toBeVisible();
});

test("a first run in the past is refused", async ({ page }) => {
  await page.goto("/account/orders");
  const first = page
    .getByRole("main")
    .getByRole("link", { name: /[A-Z0-9]+-\d{4}-\d{6}/ })
    .first();
  test.skip(!(await first.count()), "the buyer has no orders to repeat");
  await first.click();
  await page.getByText("Repeat this order on a schedule").click();
  const date = page.getByLabel("First order on");
  await date.evaluate((el) => el.removeAttribute("min"));
  await date.fill("2020-01-01");
  await page.getByRole("button", { name: "Set up recurring order" }).click();
  await expect(page.getByText("First order: choose a day from tomorrow up to one year ahead.")).toBeVisible();
});
