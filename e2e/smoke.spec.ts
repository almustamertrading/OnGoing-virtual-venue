import { expect, test, type Page } from "@playwright/test";
import { login } from "./support/login";
import { QA, authFile, readSeed } from "./support/qa";

// The 12 smoke tests from the Phase 2 directive. They run in order against the local
// stack, seeded fresh by global-setup.ts, acting as real users through the UI.

const unique = (label: string) => `${label} ${Date.now().toString(36)}`;

async function expectNoText(page: Page, text: string) {
  expect(await page.content(), `page must not contain "${text}"`).not.toContain(text);
}

test.describe("public and auth", () => {
  test("1. the app loads (public site and login page)", async ({ page }) => {
    const home = await page.goto("/");
    expect(home?.status()).toBe(200);
    await page.goto("/login");
    await expect(page.locator('form button[type="submit"]')).toHaveText("Sign in");
  });

  test("2. login works and lands on the organisation's projects", async ({ page }) => {
    await login(page, QA.users.admin);
    await expect(page.getByText(QA.orgName)).toBeVisible();
    await expect(page.getByText(QA.project).first()).toBeVisible();
  });
});

test.describe("project access", () => {
  test("3. a project member opens the project", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("viewer") });
    const page = await ctx.newPage();
    await page.goto(`/projects/${readSeed().projectId}`);
    await expect(page.getByRole("heading", { name: QA.project })).toBeVisible();
    await ctx.close();
  });

  test("4. unauthorised access is rejected", async ({ browser }) => {
    const { projectId } = readSeed();

    // Signed out: sent to login.
    const anon = await browser.newContext();
    const anonPage = await anon.newPage();
    await anonPage.goto(`/projects/${projectId}`);
    await expect(anonPage).toHaveURL(/\/login\?next=/);
    await anon.close();

    // Signed in, outside the organisation: the project does not exist for them.
    const outsider = await browser.newContext({ storageState: authFile("outsider") });
    const page = await outsider.newPage();
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByTestId("not-found")).toContainText("الصفحة غير موجودة");
    await expectNoText(page, QA.project);
    await outsider.close();
  });
});

test.describe("as the project manager", () => {
  test.use({ storageState: authFile("pm") });

  test("5. project creation", async ({ page }) => {
    const name = unique("QA PM Project");
    await page.goto("/projects");
    await page.getByRole("button", { name: "New project" }).click();
    await page.locator("#p-name").fill(name);
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
  });
});

test.describe("as a sales editor on the project", () => {
  test.use({ storageState: authFile("sales") });

  test("6. tasks can be created and updated", async ({ page }) => {
    const title = unique("QA confirm catering");
    await page.goto(`/projects/${readSeed().projectId}/tasks`);
    await page.getByRole("button", { name: "New task" }).click();
    await page.getByLabel("Task title").fill(title);
    await page.getByRole("button", { name: "Add task" }).click();
    const status = page.getByLabel(`Status of ${title}`);
    await expect(status).toHaveValue("todo");
    await status.selectOption("done");
    await expect(status).toHaveValue("done");
    await page.reload();
    await expect(page.getByLabel(`Status of ${title}`)).toHaveValue("done");
  });

  test("7. BOQ items are added and totals calculated", async ({ page }) => {
    await page.goto(`/projects/${readSeed().projectId}/pricing`);
    const add = async (description: string, quantity: string, price: string) => {
      await page.getByLabel("وصف البند").fill(description);
      await page.getByLabel("الكمية", { exact: true }).fill(quantity);
      await page.getByLabel("سعر الوحدة", { exact: true }).fill(price);
      await page.getByRole("button", { name: "إضافة بند" }).click();
      await expect(page.getByLabel(`كمية ${description}`)).toBeVisible();
    };
    await add("QA lighting rig", "3", "1250.5");
    await add("QA LED screen", "2", "4000");
    // 3 × 1,250.5 + 2 × 4,000 = 11,751.5 → shown rounded.
    await expect(page.getByRole("row", { name: /الإجمالي التقديري/ })).toContainText("SAR 11,752");
  });

  test("9a. finance data is hidden from a non-finance user", async ({ page }) => {
    const { projectId, proposalId } = readSeed();

    await page.goto(`/projects/${projectId}`);
    await expect(page.getByRole("navigation", { name: "Project sections" }).getByRole("link", { name: "Finance" })).toHaveCount(0);
    // Activity lines about invoices are filtered by the database too (checked on the full log,
    // since the overview lists only the most recent lines).
    await expect(page.getByRole("heading", { name: QA.project })).toBeVisible();
    await expectNoText(page, "QA deposit invoice");
    await page.goto(`/projects/${projectId}/activity`);
    await expect(page.getByRole("heading", { name: QA.project })).toBeVisible();
    await expectNoText(page, "QA deposit invoice");

    await page.goto(`/projects/${projectId}/finance`);
    await expect(page.getByTestId("restricted")).toBeVisible();
    await expectNoText(page, "QA deposit invoice");

    await page.goto(`/projects/${projectId}/procurement`);
    await expect(page.getByTestId("quotes-restricted")).toBeVisible();
    await expectNoText(page, "QA Audio Supplier");

    await page.goto(`/projects/${projectId}/inventory`);
    await expect(page.getByText("QA Chairs")).toBeVisible();
    await expectNoText(page, "القيمة الإجمالية");

    await page.goto(`/proposals/${proposalId}`);
    await expect(page.getByText("QA stage build").or(page.locator(`input[value="QA stage build"]`))).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "التكلفة" })).toHaveCount(0);
    await expectNoText(page, "الهامش (داخلي)");
    // The internal cost (18,000) never reaches the browser, not even in the page payload.
    await expectNoText(page, "18000");
  });

  test("10. proposal creation", async ({ page }) => {
    const title = unique("QA Conference Proposal");
    await page.goto("/proposals");
    await page.getByRole("button", { name: "عرض جديد" }).click();
    await page.locator("#pr-title").fill(title);
    await page.getByRole("button", { name: "إنشاء العرض" }).click();
    await expect(page).toHaveURL(/\/proposals\/[0-9a-f-]{36}$/);
    await expect(page.getByText(/ONG-PRO-\d{4}-\d{4}/).first()).toBeVisible();
  });
});

test.describe("as operations", () => {
  test.use({ storageState: authFile("ops") });

  test("8. suppliers can be added to the directory", async ({ page }) => {
    const name = unique("QA Security Supplier");
    await page.goto(`/projects/${readSeed().projectId}/procurement`);
    await page.getByRole("button", { name: /دليل الموردين/ }).click();
    await page.getByLabel("اسم المورّد").fill(name);
    await page.getByRole("button", { name: "إضافة مورّد" }).click();
    await expect(page.getByText(name)).toBeVisible();
  });
});

test.describe("as finance", () => {
  test.use({ storageState: authFile("finance") });

  test("9b. finance data is visible to a finance user", async ({ page }) => {
    const { projectId, proposalId } = readSeed();
    // Finance users see finance activity lines in the project's activity log…
    await page.goto(`/projects/${projectId}/activity`);
    await expect(page.getByText(/added invoices .QA deposit invoice/)).toBeVisible();
    await page.getByRole("navigation", { name: "Project sections" }).getByRole("link", { name: "Finance" }).click();
    await expect(page).toHaveURL(/\/finance$/);
    // …and the invoice itself on the Finance tab.
    await expect(page.getByText(/^QA deposit invoice/).or(page.locator(`input[value="QA deposit invoice"]`))).toBeVisible();

    await page.goto(`/proposals/${proposalId}`);
    await expect(page.getByRole("columnheader", { name: "التكلفة" })).toBeVisible();
    await expect(page.getByLabel("التكلفة")).toHaveValue("18000");
    await expect(page.getByText("الهامش (داخلي)")).toBeVisible();
  });
});

test.describe("as the organisation admin", () => {
  test.use({ storageState: authFile("admin") });

  test("11. the client PDF is generated without internal costs", async ({ page }) => {
    await page.goto(`/proposals/${readSeed().proposalId}/print`);
    await expect(page.getByText("QA stage build")).toBeVisible();
    // 2 × 30,000 = 60,000 + 15% VAT = 69,000.
    await expect(page.getByText("SAR 69,000")).toBeVisible();
    await expectNoText(page, "18000");
    await expectNoText(page, "18,000");
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(5_000);
  });

  test("12. an accepted proposal becomes a project", async ({ page }) => {
    await page.goto(`/proposals/${readSeed().proposalId}`);
    const status = page.locator("select").filter({ has: page.locator('option[value="accepted"]') });
    await status.selectOption("accepted");
    const convert = page.getByRole("button", { name: "تحويل إلى مشروع" });
    await expect(convert).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await convert.click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: QA.proposal })).toBeVisible();
    await page.getByRole("navigation", { name: "Project sections" }).getByRole("link", { name: /Pricing/ }).click();
    await expect(page.getByLabel("كمية QA stage build")).toBeVisible();
  });
});

test.describe("after the conversion", () => {
  test("13. the proposal links to its project only for people who can open it", async ({ browser }) => {
    const { proposalId } = readSeed();
    // The converter (admin) is on the new project: the link works.
    const admin = await browser.newContext({ storageState: authFile("admin") });
    const adminPage = await admin.newPage();
    await adminPage.goto(`/proposals/${proposalId}`);
    await adminPage.getByRole("link", { name: "المشروع المرتبط" }).click();
    await expect(adminPage).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
    await expect(adminPage.getByRole("heading", { name: QA.proposal })).toBeVisible();
    await admin.close();

    // Sales can read the proposal but is not on the project: a note instead of a link to a "not found" page.
    const sales = await browser.newContext({ storageState: authFile("sales") });
    const salesPage = await sales.newPage();
    await salesPage.goto(`/proposals/${proposalId}`);
    await expect(salesPage.getByTestId("project-restricted")).toContainText("تحوّل إلى مشروع لست عضوًا فيه");
    await expect(salesPage.getByRole("link", { name: "المشروع المرتبط" })).toHaveCount(0);
    await sales.close();
  });
});

