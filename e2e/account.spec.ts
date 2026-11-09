import { expect, test } from "@playwright/test";
import { login } from "./support/login";
import { QA, authFile } from "./support/qa";

// Account security: password change, sign-out of other sessions, open-redirect protection.
// Uses the dedicated `account` user so other suites' sessions are never revoked.

test.describe("account security", () => {
  test("a user changes their password; the old one stops working", async ({ browser }) => {
    const newPassword = `New-Local-Pass-${Date.now()}`;
    const ctx = await browser.newContext({ storageState: authFile("account") });
    const page = await ctx.newPage();
    await page.goto("/settings/account");
    await page.getByLabel("كلمة المرور الحالية").fill(QA.password);
    await page.getByLabel("كلمة المرور الجديدة", { exact: true }).fill(newPassword);
    await page.getByLabel("تأكيد كلمة المرور الجديدة").fill(newPassword);
    await page.getByRole("button", { name: "حفظ كلمة المرور" }).click();
    await expect(page.getByRole("status")).toContainText("تم تغيير كلمة المرور");
    await ctx.close();

    // The old password is rejected…
    const fresh = await browser.newContext();
    const p2 = await fresh.newPage();
    await p2.goto("/login");
    await p2.locator("#email").fill(QA.users.account);
    await p2.locator('input[name="password"]').fill(QA.password);
    await p2.locator('form button[type="submit"]').click();
    await expect(p2.getByText(/invalid login credentials/i)).toBeVisible();
    // …and the new one works.
    await login(p2, QA.users.account, newPassword);
    await expect(p2).toHaveURL(/\/projects/);
    await fresh.close();
  });

  test("a wrong current password is refused", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("viewer") });
    const page = await ctx.newPage();
    await page.goto("/settings/account");
    await page.getByLabel("كلمة المرور الحالية").fill("not-the-password");
    await page.getByLabel("كلمة المرور الجديدة", { exact: true }).fill("Another-Long-Password-1");
    await page.getByLabel("تأكيد كلمة المرور الجديدة").fill("Another-Long-Password-1");
    await page.getByRole("button", { name: "حفظ كلمة المرور" }).click();
    await expect(page.getByText("كلمة المرور الحالية غير صحيحة")).toBeVisible();
    await ctx.close();
  });

  test("login never redirects to another site", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("viewer") });
    const page = await ctx.newPage();
    await page.goto("/login?next=https://evil.example/steal");
    await expect(page).toHaveURL(/localhost:\d+\/projects/);
    await page.goto("/login?next=//evil.example");
    await expect(page).toHaveURL(/localhost:\d+\/projects/);
    await ctx.close();
  });

  test("the reset page answers without revealing whether an account exists", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/login\/reset$/);
    // Submit only once the form is interactive (the first dev-mode compile is slow).
    await page.waitForLoadState("networkidle");
    await page.locator("#reset-email").fill("nobody@nowhere.test");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText("If an account exists");
  });
});
