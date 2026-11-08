import { expect, test } from "@playwright/test";

// Demo personas (DEMO_MODE with DEMO_PASSWORD on the server; skipped otherwise). Signing in creates a session only;
// nothing in the project changes. `next-dev-demo` in .claude/launch.json starts such a server.
test.describe("demo personas", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    test.skip(!(await page.locator("#demo").isVisible()), "DEMO_MODE is off on this server");
  });

  test("shows the demo banner and keeps the password out of the page", async ({ page }) => {
    await expect(page.getByText(/^Demo store:/)).toBeVisible();
    const html = await page.content();
    expect(html).not.toMatch(/name="password"[^>]*value=/);
    expect(await page.locator("#demo input[type=password]").count()).toBe(0);
  });

  for (const [role, start, heading] of [
    ["Buyer", "/account", /My account|Dashboard/i],
    ["Approver", "/account/approvals", /Approvals/i],
    ["Admin", "/account/company", /Company/i],
  ] as const) {
    test(`signs in as the ${role.toLowerCase()}`, async ({ page }) => {
      await page.getByRole("button", { name: new RegExp(`^Try as ${role}`) }).click();
      await expect(page).toHaveURL(new RegExp(`${start}$`), { timeout: 45_000 });
      await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true }).first()).toHaveText(heading);
      await page.goto("/logout");
    });
  }

  test("locks the password change for a persona", async ({ page }) => {
    await page.getByRole("button", { name: /^Try as Buyer/ }).click();
    await page.waitForURL(/\/account$/, { timeout: 45_000 });
    await page.goto("/account/information");
    await page.getByLabel("Current password").fill("not-the-password");
    await page.getByLabel(/^New password/).fill("a-new-password-1234");
    await page.getByLabel("Confirm new password").fill("a-new-password-1234");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(
      page
        .getByText(/shared demo account/)
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await page.goto("/logout");
  });
});
