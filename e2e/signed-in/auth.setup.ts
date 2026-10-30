import { test as setup } from "@playwright/test";
import { ACCOUNTS, signIn, stateFile, type Role } from "./accounts";

// Signs each demo person in once and stores the session cookies for the signed-in tests.
for (const role of Object.keys(ACCOUNTS) as Role[]) {
  setup(`sign in as the ${role}`, async ({ page }) => {
    await signIn(page, role);
    await page.context().storageState({ path: stateFile(role) });
  });
}
