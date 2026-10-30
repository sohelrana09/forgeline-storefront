import type { Page } from "@playwright/test";

// The demo company's people (LiftTech Soluciones S.L., Spain) and their stored sessions. Emails can be overridden for
// another project; the password comes from the environment (see playwright.config.ts), never from the code.
try {
  process.loadEnvFile(".env.demo");
} catch {
  // E2E_PASSWORD from the environment instead.
}

export const ACCOUNTS = {
  buyer: process.env.E2E_BUYER_EMAIL ?? "sofia-lopez@ltsl.com",
  approver: process.env.E2E_APPROVER_EMAIL ?? "carlos-garcia@ltsl.com",
  admin: process.env.E2E_ADMIN_EMAIL ?? "oliver-smith@ltsl.com",
} as const;
export type Role = keyof typeof ACCOUNTS;

export const stateFile = (role: Role) => `e2e/.auth/${role}.json`;

const password = () => {
  const value = process.env.E2E_PASSWORD ?? process.env.DEMO_BUYER_PASSWORD;
  if (!value) throw new Error("Set E2E_PASSWORD (or DEMO_BUYER_PASSWORD in .env.demo) for the signed-in tests");
  return value;
};

// Signs in through the form like a person: the form refuses submissions faster than 1.5 s (bot check).
export async function signIn(page: Page, role: Role) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ACCOUNTS[role]);
  await page.getByLabel("Password").fill(password());
  await page.waitForTimeout(1700);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.getByRole("button", { name: "Sign out" }).waitFor();
}
