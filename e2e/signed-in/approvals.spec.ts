import { expect, test, type Page } from "@playwright/test";
import { stateFile } from "./accounts";

// Order approvals in the demo company's Spanish unit, where the rule "Orders over €10,000" (npm run
// ct:seed-approval-rules) has approved and rejected orders from the T5.2 spike. The tests place no orders: they read
// the decided ones, and the admin's rule edit is put back even when a step fails.

const UNIT = "lifttech-solutions-ltd-es";

// Admins of the parent company see several units; the rules belong to the Spanish one. The switch is a form action
// (the ct_bu cookie of this browser context only), so wait until the page shows the unit.
async function selectUnit(page: Page) {
  const picker = page.getByLabel("Buying for");
  if ((await picker.count()) && (await picker.inputValue()) !== UNIT) {
    await picker.selectOption(UNIT);
    await expect(page.getByRole("main")).toContainText("Orders for LiftTech Soluciones S.L.");
  }
}

test.describe("approver", () => {
  test.use({ storageState: stateFile("approver") });

  test("sees decided approvals with who decided them", async ({ page }) => {
    await page.goto("/account/approvals?view=all&limit=50");
    await expect(page.getByRole("heading", { level: 1, name: "Order approvals" })).toBeVisible();
    const rows = page.getByRole("region", { name: "Approvals" }).getByRole("row");

    const approved = rows.filter({ hasText: "Approved" }).first();
    await expect(approved).toContainText("Orders over €10,000");
    await approved.getByRole("link", { name: /^View order / }).click();
    await page.waitForURL(/\/account\/approvals\/[0-9a-f-]{36}$/);
    await expect(page.getByText(/^Approved by .+ on /)).toBeVisible();
    // A decided flow offers no decision.
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);

    await page.goto("/account/approvals?view=all&limit=50");
    await rows
      .filter({ hasText: "Rejected" })
      .first()
      .getByRole("link", { name: /^View order / })
      .click();
    await expect(page.getByText(/^Rejected by .+ on .+:/)).toBeVisible();
  });
});

test.describe("buyer", () => {
  test.use({ storageState: stateFile("buyer") });

  test("sees the approval status on My orders and the order page", async ({ page }) => {
    await page.goto("/account/orders?limit=50");
    const rows = page.getByRole("region", { name: "Orders" }).getByRole("row");
    await expect(rows.filter({ hasText: "Approved" }).first()).toBeVisible();

    await rows
      .filter({ hasText: "Rejected" })
      .first()
      .getByRole("link", { name: /^View order / })
      .click();
    await page.waitForURL(/\/account\/orders\/[0-9a-f-]{36}$/);
    const approval = page.getByRole("region", { name: "Approval" });
    await expect(approval).toContainText("Rejected");
    await expect(approval).toContainText("Orders over €10,000");
  });
});

test.describe("admin", () => {
  test.use({ storageState: stateFile("admin") });

  test("edits an approval rule and puts it back", async ({ page }) => {
    await page.goto("/account/company/approval-rules");
    await selectUnit(page);
    await page.getByRole("link", { name: "Edit Orders over €10,000" }).click();
    await page.waitForURL(/\/account\/company\/approval-rules\/[0-9a-f-]{36}$/);
    const editUrl = page.url();
    const description = page.getByLabel("Description (optional)");
    const original = await description.inputValue();
    await expect(page.getByLabel(/^Needs approval when the order total is above/)).toHaveValue(/^10[ ,]?000$/);

    const marker = `E2E check ${Date.now()}`;
    try {
      await description.fill(marker);
      await page.getByRole("button", { name: "Save rule" }).click();
      await page.waitForURL(/\/account\/company\/approval-rules\?saved=1$/);
      await expect(page.getByText("You saved the approval rule.")).toBeVisible();
      await page.goto(editUrl);
      await expect(page.getByLabel("Description (optional)")).toHaveValue(marker);
    } finally {
      // Restore the description, whatever happened above.
      await page.goto(editUrl);
      await page.getByLabel("Description (optional)").fill(original);
      await page.getByRole("button", { name: "Save rule" }).click();
      await page.waitForURL(/\/account\/company\/approval-rules\?saved=1$/);
    }
    await page.goto(editUrl);
    await expect(page.getByLabel("Description (optional)")).toHaveValue(original);
  });
});
