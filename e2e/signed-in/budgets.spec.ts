import { expect, test, type Page } from "@playwright/test";
import { stateFile } from "./accounts";

// Spending budgets (docs/features/spending-limits.md). Needs a server with SPENDING_LIMITS=true; set
// E2E_SPENDING_LIMITS=1 to run. The admin gives the buyer a small budget, the buyer sees it, and the admin puts the
// form back exactly as it was, also when a step fails.

test.skip(process.env.E2E_SPENDING_LIMITS !== "1", "E2E_SPENDING_LIMITS=1 (server with SPENDING_LIMITS=true) not set");

const BUYER_NAME = /Sofía López/;
const UNIT = "lifttech-solutions-ltd-es";

async function buyerRow(page: Page) {
  await page.goto("/account/company/budgets");
  await expect(page.getByRole("heading", { level: 1, name: "Budgets" })).toBeVisible();
  // The admin works for the parent company too; the buyer is in the Spanish unit (the ct_bu cookie of this context only).
  const picker = page.getByLabel("Buying for");
  if ((await picker.count()) && (await picker.inputValue()) !== UNIT) {
    await picker.selectOption(UNIT);
    await expect(page.getByRole("main")).toContainText("Spending limits for LiftTech Soluciones S.L.");
  }
  const row = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: BUYER_NAME }) });
  return {
    amount: row.getByRole("textbox"),
    period: row.getByRole("combobox").first(),
    mode: row.getByRole("combobox").last(),
  };
}

async function save(page: Page) {
  await page.getByRole("button", { name: "Save budgets" }).click();
  await expect(page.getByText("You saved the budgets.")).toBeVisible();
}

test("an admin sets a buyer's budget, the buyer sees what is left, and the form is put back", async ({ browser }) => {
  const admin = await browser.newContext({ storageState: stateFile("admin") });
  const page = await admin.newPage();
  const row = await buyerRow(page);
  const before = { amount: await row.amount.inputValue(), period: await row.period.inputValue(), mode: await row.mode.inputValue() };
  try {
    await row.amount.fill("1.00");
    await row.period.selectOption("monthly");
    await row.mode.selectOption("block");
    await save(page);

    const buyer = await browser.newContext({ storageState: stateFile("buyer") });
    try {
      const p = await buyer.newPage();
      await p.goto("/account/company/budgets");
      const mine = p.getByRole("region", { name: "What you can still spend" });
      await expect(mine).toContainText("Your budget this month");
      await expect(mine).toContainText("1.00");
      // Buyers see what is left, not the form.
      await expect(p.getByRole("button", { name: "Save budgets" })).toHaveCount(0);
    } finally {
      await buyer.close();
    }
  } finally {
    const again = await buyerRow(page);
    await again.amount.fill(before.amount);
    await again.period.selectOption(before.period);
    await again.mode.selectOption(before.mode);
    await save(page);
    await admin.close();
  }
});

test("the amount is checked before anything is saved", async ({ browser }) => {
  const admin = await browser.newContext({ storageState: stateFile("admin") });
  try {
    const page = await admin.newPage();
    const row = await buyerRow(page);
    await row.amount.fill("-5");
    await page.getByRole("button", { name: "Save budgets" }).click();
    await expect(page.getByText("Budget: enter an amount such as 5000 or 5000.50.")).toBeVisible();
  } finally {
    await admin.close();
  }
});
