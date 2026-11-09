import { expect, test as setup } from "@playwright/test";
import { QA, authFile, type QaRole } from "./support/qa";
import { login } from "./support/login";

// Signs each QA user in through the real login form once and saves the session.
for (const role of Object.keys(QA.users) as QaRole[]) {
  setup(`sign in as ${role}`, async ({ page }) => {
    await login(page, QA.users[role]);
    await expect(page).toHaveURL(/\/projects/);
    await page.context().storageState({ path: authFile(role) });
  });
}
