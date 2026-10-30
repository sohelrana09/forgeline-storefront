import { expect, test } from "@playwright/test";
import { signIn, stateFile } from "./accounts";

// What each role may open in the company area, and signing out.

test.describe("approver", () => {
  test.use({ storageState: stateFile("approver") });

  test("sees order approvals but no company lists", async ({ page }) => {
    await page.goto("/account/approvals");
    await expect(page.getByRole("heading", { level: 1, name: "Order approvals" })).toBeVisible();
    await page.goto("/account/purchase-lists");
    await expect(page.getByRole("heading", { level: 1, name: "Purchase lists" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Company lists" })).toHaveCount(0);
  });
});

test.describe("buyer", () => {
  test.use({ storageState: stateFile("buyer") });

  test("is sent back from the approvals and approval rules pages", async ({ page }) => {
    for (const path of ["/account/approvals", "/account/company/approval-rules"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/account$/);
    }
  });
});

test.describe("admin", () => {
  test.use({ storageState: stateFile("admin") });

  test("manages company users", async ({ page }) => {
    await page.goto("/account/company/users");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("users");
    await expect(page.getByRole("main")).toContainText("Oliver");
  });
});

test("signing out ends the session", async ({ browser }) => {
  // A fresh sign-in, so signing out never revokes the stored sessions the other tests use.
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, "buyer");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("You are signed out.")).toBeVisible();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
  await context.close();
});
