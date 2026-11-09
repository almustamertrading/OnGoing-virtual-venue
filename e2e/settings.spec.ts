import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { localSupabase } from "./support/local-supabase";
import { QA, authFile, readSeed } from "./support/qa";

// Workstream A: Settings & Administration, in its own namespace and port:
//   E2E_NAMESPACE=settings E2E_PORT=3201 npx playwright test e2e/settings.spec.ts
// global-setup.ts seeds the namespace's organisation fresh on every run.

/** Opens a page and waits until it is interactive (the first dev-mode compile is slow). */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

const VAT = /نسبة ضريبة القيمة المضافة/;

test.describe("as the organisation admin", () => {
  test.use({ storageState: authFile("admin") });

  test("(a) admin edits the organisation settings and they persist after a reload", async ({ page }) => {
    await open(page, "/settings/organization");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "إعدادات المنظمة" })).toBeVisible();
    await expect(main.getByLabel("المنطقة الزمنية")).toHaveValue("Asia/Riyadh");

    // Invalid values are refused with Arabic messages, and what was typed stays in the form.
    await main.getByLabel(VAT).fill("150");
    await main.getByLabel("الموقع الإلكتروني").fill("javascript:alert(1)");
    await main.getByRole("button", { name: "حفظ الإعدادات" }).click();
    await expect(main.getByRole("alert")).toContainText("لم تُحفظ الإعدادات");
    await expect(main.getByText("نسبة الضريبة يجب أن تكون بين 0 و100.")).toBeVisible();
    await expect(main.getByLabel(VAT)).toHaveValue("150");
    await expect(main.getByLabel(VAT)).toHaveAttribute("aria-invalid", "true");
    await expect(main.getByLabel("الموقع الإلكتروني")).toHaveValue("javascript:alert(1)");

    const name = `${QA.orgName} Ltd`;
    await main.getByLabel("اسم المنظمة").fill(name);
    await main.getByLabel("العملة").selectOption("AED");
    await main.getByLabel("المنطقة الزمنية").selectOption("Asia/Dubai");
    await main.getByLabel(VAT).fill("5");
    await main.getByLabel("الرقم الضريبي").fill("100000000000003");
    await main.getByLabel("العنوان").fill("شارع الشيخ زايد، دبي");
    await main.getByLabel("الهاتف").fill("+971 4 000 0000");
    await main.getByLabel("الموقع الإلكتروني").fill("qa-settings.example");
    await main.getByRole("button", { name: "حفظ الإعدادات" }).click();
    await expect(main.getByRole("status").filter({ hasText: "تم حفظ إعدادات المنظمة" })).toBeVisible();
    await expect(main.getByRole("alert")).toHaveCount(0);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(main.getByLabel("اسم المنظمة")).toHaveValue(name);
    await expect(main.getByLabel("العملة")).toHaveValue("AED");
    await expect(main.getByLabel("المنطقة الزمنية")).toHaveValue("Asia/Dubai");
    await expect(main.getByLabel(VAT)).toHaveValue("5");
    await expect(main.getByLabel("الرقم الضريبي")).toHaveValue("100000000000003");
    await expect(main.getByLabel("العنوان")).toHaveValue("شارع الشيخ زايد، دبي");
    await expect(main.getByLabel("الهاتف")).toHaveValue("+971 4 000 0000");
    // A website without a scheme is saved as https.
    await expect(main.getByLabel("الموقع الإلكتروني")).toHaveValue("https://qa-settings.example");
  });

  test("(c) admin adds an email domain, then removes it after confirming", async ({ page }) => {
    const domain = `added-${Date.now().toString(36)}.${QA.namespace}-e2e.test`;
    await open(page, "/settings/domains");
    const main = page.getByRole("main");
    await expect(main.getByText("بصلاحية «مشاهدة» فقط")).toBeVisible();
    await expect(main.getByTestId("domain-row").filter({ hasText: QA.domain })).toBeVisible();

    // A malformed domain is refused.
    await main.getByLabel("نطاق جديد").fill("not a domain");
    await main.getByRole("button", { name: "إضافة النطاق" }).click();
    await expect(main.getByRole("alert")).toContainText("صيغة النطاق غير صحيحة");

    // Upper case and spaces are normalised before saving.
    await main.getByLabel("نطاق جديد").fill(`  ${domain.toUpperCase()} `);
    await main.getByRole("button", { name: "إضافة النطاق" }).click();
    const row = main.getByTestId("domain-row").filter({ hasText: domain });
    await expect(row).toBeVisible();
    await expect(main.getByRole("status").filter({ hasText: `أُضيف النطاق ${domain}` })).toBeVisible();
    await expect(main.getByLabel("نطاق جديد")).toHaveValue("");

    // Removing asks for confirmation; cancelling keeps the domain.
    const remove = row.getByRole("button", { name: `إزالة ${domain}` });
    await remove.click();
    await row.getByRole("button", { name: "إلغاء" }).click();
    await expect(remove).toBeFocused();
    await expect(row).toBeVisible();

    await remove.click();
    const confirm = row.getByRole("button", { name: "تأكيد الإزالة" });
    await expect(confirm).toBeFocused();
    await confirm.click();
    await expect(main.getByTestId("domain-row").filter({ hasText: domain })).toHaveCount(0);
    await expect(main.getByRole("status").filter({ hasText: `أُزيل النطاق ${domain}` })).toBeVisible();

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(main.getByTestId("domain-row").filter({ hasText: domain })).toHaveCount(0);
    await expect(main.getByTestId("domain-row").filter({ hasText: QA.domain })).toBeVisible();
  });

  test("(d) a capability change on the Members page appears in the audit log with the actor's email", async ({ page }) => {
    await open(page, "/settings/members");
    const member = page.getByTestId("member-row").filter({ hasText: QA.users.pm });
    const finance = member.getByRole("checkbox", { name: "المالية" });
    await expect(finance).not.toBeChecked();
    await finance.click();
    // Checked once the database has accepted the change and the page has refreshed.
    await expect(finance).toBeChecked();

    await open(page, "/settings/audit");
    // Newest first: the seed's own capability change for this member (by the system) comes later.
    const entry = page
      .getByTestId("audit-row")
      .filter({ hasText: "تغيير الصلاحيات" })
      .filter({ hasText: QA.users.pm })
      .first();
    await expect(entry).toContainText(QA.users.admin);
    await expect(entry).toContainText("من «مدير مشاريع» إلى «مدير مشاريع، المالية»");
    await expect(entry).toContainText("أُضيفت: المالية");
  });

  test("(f) the audit log shows 25 entries per page", async ({ page }) => {
    // Extra history through the local admin client: each update writes one audit entry.
    const env = localSupabase();
    const db = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { organizationId, userIds } = readSeed();
    for (let i = 0; i < 13; i++) {
      for (const capabilities of [["operations_access", "sales_access"], ["operations_access"]]) {
        const { error } = await db
          .from("organization_members")
          .update({ capabilities })
          .eq("organization_id", organizationId)
          .eq("user_id", userIds.ops);
        expect(error).toBeNull();
      }
    }
    const { count, error } = await db
      .from("organization_audit")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId);
    expect(error).toBeNull();
    const total = count ?? 0;
    const pages = Math.ceil(total / 25);
    expect(pages).toBeGreaterThanOrEqual(2);

    await open(page, "/settings/audit");
    const pager = page.getByRole("navigation", { name: "صفحات سجل التدقيق" });
    await expect(pager).toContainText(`صفحة 1 من ${pages}`);
    await expect(page.getByTestId("audit-row")).toHaveCount(25);
    // The newest entries are the system's changes just made.
    await expect(page.getByTestId("audit-row").first()).toContainText("النظام");

    await pager.getByRole("link", { name: /الصفحة التالية/ }).click();
    await expect(page).toHaveURL(/\/settings\/audit\?page=2$/);
    await expect(pager).toContainText(`صفحة 2 من ${pages}`);
    await expect(page.getByTestId("audit-row")).toHaveCount(pages === 2 ? total - 25 : 25);

    // A page past the end shows the last page.
    await open(page, "/settings/audit?page=999");
    await expect(pager).toContainText(`صفحة ${pages} من ${pages}`);
  });
});

test.describe("as a viewer", () => {
  test.use({ storageState: authFile("viewer") });

  test("(b) a viewer sees the settings read-only and gets Restricted on admin-only sections", async ({ page }) => {
    await open(page, "/settings/organization");
    const main = page.getByRole("main");
    await expect(main.getByTestId("org-readonly")).toContainText(QA.orgName);
    await expect(main.getByText("يمكن لمدير المنظمة فقط تعديل هذه الإعدادات")).toBeVisible();
    await expect(main.locator("input, select, textarea")).toHaveCount(0);
    await expect(main.getByRole("button", { name: "حفظ الإعدادات" })).toHaveCount(0);

    // The section navigation marks what this viewer cannot change.
    const nav = page.getByRole("navigation", { name: "أقسام الإعدادات" });
    await expect(nav.getByRole("link", { name: /^المنظمة/ })).toContainText("للعرض فقط");
    await expect(nav.getByRole("link", { name: /^سجل التدقيق/ })).toContainText("لمدير المنظمة فقط");
    await expect(nav.getByRole("link", { name: /^نطاقات البريد/ })).toContainText("لمدير المنظمة فقط");

    await open(page, "/settings/audit");
    await expect(page.getByTestId("restricted")).toBeVisible();
    await expect(page.getByTestId("audit-row")).toHaveCount(0);

    await open(page, "/settings/domains");
    await expect(page.getByTestId("restricted")).toBeVisible();
    await expect(page.getByLabel("نطاق جديد")).toHaveCount(0);
  });
});

test.describe("layout", () => {
  test("(e) /settings opens Account, and every section fits a 375 px screen", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings\/account$/);
    await page.waitForLoadState("networkidle");
    const nav = page.getByRole("navigation", { name: "أقسام الإعدادات" });
    await expect(nav.getByRole("link", { name: /^الحساب/ })).toHaveAttribute("aria-current", "page");
    // On a phone the sections scroll sideways inside their own strip.
    await expect.poll(() => nav.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");

    for (const path of ["/settings/account", "/settings/organization", "/settings/members", "/settings/domains", "/settings/audit"]) {
      await open(page, path);
      await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} must not scroll sideways at 375 px`).toBeLessThanOrEqual(0);
    }
    await ctx.close();
  });
});
