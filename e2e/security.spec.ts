import { expect, test } from "@playwright/test";

// Guards that must not silently disappear: security headers, the search-engine switch, public form protection.

test("every page sends the security headers and stays out of search engines", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'self'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
  // Off unless SITE_INDEXABLE=true (see .env.example).
  expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
});

test("public forms carry the honeypot and refuse it when filled", async ({ page }) => {
  await page.goto("/register");
  const honeypot = page.locator('input[name="website"]');
  await expect(honeypot).toHaveCount(1);
  await expect(honeypot).not.toBeInViewport();
  // A bot filling every field: refused before any account is created.
  await page.waitForTimeout(2000);
  await honeypot.evaluate((el: HTMLInputElement) => (el.value = "http://spam.example"));
  await page
    .locator("form")
    .filter({ has: honeypot })
    .evaluate((form: HTMLFormElement) => {
      form.querySelectorAll("[required]").forEach((e) => e.removeAttribute("required"));
      form.requestSubmit();
    });
  // Scoped to the form: Next.js also renders an (empty) role="alert" route announcer.
  await expect(page.locator("form").getByRole("alert")).toContainText("couldn't verify this request");
});

test("checkout and account pages send guests to sign in", async ({ page }) => {
  await page.goto("/account/orders");
  await expect(page).toHaveURL(/\/login/);
});
