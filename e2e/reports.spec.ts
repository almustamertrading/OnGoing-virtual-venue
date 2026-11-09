import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { localSupabase } from "./support/local-supabase";
import { QA, authFile, readSeed } from "./support/qa";

// Reports & Analytics (Workstream D), acting as real users against the local stack:
//   E2E_NAMESPACE=reports E2E_PORT=3204 npx playwright test e2e/reports.spec.ts
//
// Seeded by global-setup.ts: "QA Gala Dinner" (confirmed, budget 500,000) with an invoice of
// 150,000 (sent, unpaid), an expense of 90,000 and one RFQ with a 42,000 quote, plus a draft
// proposal worth 2 × 30,000. The hook below adds delivery data, decided proposals and a project
// whose name is a spreadsheet formula.

const FORMULA_PROJECT = "=1+2 QA formula";
const projectRow = (page: Page, table: string, name: string = QA.project) =>
  page.getByTestId(table).getByRole("row", { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });

async function expectNoText(page: Page, text: string) {
  expect(await page.content(), `page must not contain "${text}"`).not.toContain(text);
}

async function openReports(page: Page) {
  const response = await page.goto("/reports");
  // The route compiles on its first visit in dev mode; let it settle before interacting.
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: "التقارير والتحليلات" })).toBeVisible();
  return response;
}

async function downloadCsv(page: Page, section: string) {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId(`csv-${section}`).click()]);
  const bytes = fs.readFileSync(await download.path());
  return { name: download.suggestedFilename(), bytes, lines: bytes.subarray(3).toString("utf8").split("\r\n") };
}

test.beforeAll(async () => {
  // Local service-role client: test data only, in this namespace's QA organisation.
  const env = localSupabase();
  const db = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { organizationId, projectId, userIds } = readSeed();
  const by = userIds.admin;
  const ok = (res: { error: { message: string } | null }, what: string) => {
    if (res.error) throw new Error(`Report fixtures failed (${what}): ${res.error.message}`);
  };

  // Idempotent: a restarted worker runs this hook again.
  ok(await db.from("tasks").delete().eq("project_id", projectId).like("title", "QA report %"), "clear tasks");
  ok(await db.from("milestones").delete().eq("project_id", projectId).like("title", "QA report %"), "clear milestones");
  ok(await db.from("proposals").delete().eq("organization_id", organizationId).like("title", "QA report %"), "clear proposals");
  ok(await db.from("projects").delete().eq("organization_id", organizationId).eq("name", FORMULA_PROJECT), "clear project");

  ok(await db.from("tasks").insert([
    { project_id: projectId, title: "QA report task done", status: "done", created_by: by },
    { project_id: projectId, title: "QA report task overdue", status: "todo", due_date: "2020-01-15", created_by: by },
    { project_id: projectId, title: "QA report task blocked", status: "blocked", created_by: by },
  ]), "tasks");
  ok(await db.from("milestones").insert([
    { project_id: projectId, title: "QA report milestone done", done: true, due_date: "2020-02-01", created_by: by },
    { project_id: projectId, title: "QA report milestone next", done: false, due_date: "2099-06-01", created_by: by },
  ]), "milestones");
  ok(await db.from("proposals").insert([
    { organization_id: organizationId, title: "QA report proposal won", proposal_type: "technical_financial", status: "accepted", owner_id: by, created_by: by },
    { organization_id: organizationId, title: "QA report proposal lost", proposal_type: "technical_financial", status: "rejected", owner_id: by, created_by: by },
  ]), "proposals");
  // Only the admin (its creator) is on this project, so the other roles never see it.
  ok(await db.from("projects").insert({
    organization_id: organizationId, name: FORMULA_PROJECT, status: "lead", project_type: "other", created_by: by,
  }), "formula project");
});

test.describe("as the organisation admin", () => {
  test.use({ storageState: authFile("admin") });

  test("a. sees all five sections, the summary and the finance figures per project", async ({ page }) => {
    await openReports(page);
    for (const id of ["pipeline", "proposals", "delivery", "procurement", "finance"]) {
      await expect(page.getByTestId(`section-${id}`)).toBeVisible();
    }

    const card = (key: string) => page.getByTestId(`summary-${key}`).locator("[data-value]");
    await expect(card("active")).toHaveText("2");
    await expect(card("pipeline")).toHaveText("SAR 500,000");
    await expect(card("win-rate")).toHaveText("50%");
    await expect(card("overdue")).toHaveText("1");
    await expect(card("receivables")).toHaveText("SAR 150,000");

    // Pipeline: an accessible SVG chart plus the table it summarises.
    const pipeline = page.getByTestId("section-pipeline");
    await expect(pipeline.getByRole("img", { name: /^عدد المشاريع حسب الحالة: .*مؤكد 1/ })).toBeVisible();
    await expect(pipeline.getByRole("img", { name: /^إجمالي الميزانيات حسب الحالة: .*مؤكد SAR 500,000/ })).toBeVisible();
    const confirmed = page.getByTestId("pipeline-table").getByRole("row", { name: /مؤكد/ });
    await expect(confirmed.locator('[data-col="projects"]')).toHaveText("1");
    await expect(confirmed.locator('[data-col="budget"]')).toHaveText("SAR 500,000");

    // Proposals funnel: 1 accepted of 2 decided.
    await expect(page.getByTestId("win-rate")).toContainText("50%");
    await expect(page.getByTestId("proposals-table").getByRole("row", { name: /مسودة/ }).locator('[data-col="value"]')).toHaveText("SAR 60,000");

    // Finance per project.
    const finance = projectRow(page, "finance-table");
    await expect(finance.locator('[data-col="budget"]')).toHaveText("SAR 500,000");
    await expect(finance.locator('[data-col="invoiced"]')).toHaveText("SAR 150,000");
    await expect(finance.locator('[data-col="paid"]')).toHaveText("SAR 0");
    await expect(finance.locator('[data-col="outstanding"]')).toHaveText("SAR 150,000");
    await expect(finance.locator('[data-col="expenses"]')).toHaveText("SAR 90,000");
    await expect(finance.locator('[data-col="margin"]')).toHaveText("SAR 60,000");
    await expect(page.getByTestId("finance-totals").locator('[data-col="outstanding"]')).toHaveText("SAR 150,000");

    // Procurement: finance access, so real figures and no lock.
    const procurement = projectRow(page, "procurement-table");
    await expect(procurement.locator('[data-col="rfqs"]')).toHaveText("1");
    await expect(procurement.locator('[data-col="quotes"]')).toHaveText("1");
    await expect(procurement.locator('[data-col="awarded-value"]')).toHaveText("SAR 0");
    await expect(page.getByTestId("section-procurement").getByTestId("restricted-value")).toHaveCount(0);

    // Delivery: overdue work is highlighted and listed first.
    const delivery = projectRow(page, "delivery-table");
    await expect(page.getByTestId("delivery-table").locator("tbody tr").first()).toContainText(QA.project);
    await expect(delivery).toHaveAttribute("data-overdue", "true");
    await expect(delivery.locator('[data-col="overdue"]')).toHaveText("1 متأخرة");
    await expect(delivery.locator('[data-col="completion"]')).toContainText("33%");
    await expect(delivery.locator('[data-col="completion"]')).toContainText("1/3");
    await expect(delivery.locator('[data-col="blocked"]')).toHaveText("1");
    await expect(delivery.locator('[data-col="milestones"]')).toHaveText("1/2");
    await expect(delivery.locator('[data-col="next-milestone"]')).toHaveText("1 Jun 2099");
  });

  test("c. downloads the pipeline table as a UTF-8 CSV with a BOM and a header row", async ({ page }) => {
    await openReports(page);
    const csv = await downloadCsv(page, "pipeline");
    expect(csv.name).toMatch(/^ongoing-pipeline-\d{4}-\d{2}-\d{2}\.csv$/);
    expect([...csv.bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv.lines[0]).toBe("الحالة,عدد المشاريع,إجمالي الميزانيات (SAR)");
    expect(csv.lines).toContain("مؤكد,1,500000");
    expect(csv.lines).toContain("فرصة,1,0");
    expect(csv.lines).toContain("الإجمالي,2,500000");
  });

  test("neutralises a spreadsheet formula in a project name in the CSV export", async ({ page }) => {
    await openReports(page);
    const csv = await downloadCsv(page, "delivery");
    expect(csv.name).toMatch(/^ongoing-delivery-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv.lines.some((line) => line.includes(`,'${FORMULA_PROJECT},`))).toBe(true);
    expect(csv.lines.some((line) => line.includes(`,${FORMULA_PROJECT},`))).toBe(false);
  });
});

test.describe("as a sales user on the project", () => {
  test.use({ storageState: authFile("sales") });

  test("b. sees pipeline and delivery, but finance is restricted and no finance figure reaches the page", async ({ page }) => {
    await openReports(page);

    const confirmed = page.getByTestId("pipeline-table").getByRole("row", { name: /مؤكد/ });
    await expect(confirmed.locator('[data-col="projects"]')).toHaveText("1");
    await expect(projectRow(page, "delivery-table")).toHaveAttribute("data-overdue", "true");

    const finance = page.getByTestId("section-finance");
    await expect(finance.getByTestId("restricted")).toBeVisible();
    await expect(finance.getByTestId("restricted")).toContainText("التقارير المالية مقيدة");
    await expect(page.getByTestId("finance-table")).toHaveCount(0);
    await expect(page.getByTestId("csv-finance")).toHaveCount(0);
    await expect(page.getByTestId("summary-receivables")).toHaveCount(0);

    // Supplier quote figures are internal costs: a lock and "مقيد", not 0.
    const procurement = projectRow(page, "procurement-table");
    await expect(procurement.locator('[data-col="rfqs"]')).toHaveText("1");
    await expect(procurement.locator('[data-col="quotes"]')).toHaveText(/مقيد/);
    await expect(procurement.locator('[data-col="awarded-value"]')).toHaveText(/مقيد/);

    // Not in the HTML nor in the page payload: expenses, invoices, the quote amount.
    await expectNoText(page, "90,000");
    await expectNoText(page, "150,000");
    await expectNoText(page, "42,000");
    // The admin-only project is not visible either.
    await expectNoText(page, "QA formula");
  });
});

test.describe("as finance", () => {
  test.use({ storageState: authFile("finance") });

  test("sees finance per project, receivables and quote figures", async ({ page }) => {
    await openReports(page);
    const finance = projectRow(page, "finance-table");
    await expect(finance.locator('[data-col="expenses"]')).toHaveText("SAR 90,000");
    await expect(finance.locator('[data-col="margin"]')).toHaveText("SAR 60,000");
    await expect(page.getByTestId("summary-receivables").locator("[data-value]")).toHaveText("SAR 150,000");
    await expect(projectRow(page, "procurement-table").locator('[data-col="quotes"]')).toHaveText("1");
  });
});

test.describe("as a viewer", () => {
  test.use({ storageState: authFile("viewer") });

  test("d. opens the reports page without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const response = await openReports(page);
    expect(response?.status()).toBe(200);
    await expect(projectRow(page, "delivery-table")).toBeVisible();
    await expect(page.getByTestId("section-finance").getByTestId("restricted")).toBeVisible();
    await expectNoText(page, "90,000");
    expect(errors).toEqual([]);
  });
});

test.describe("on a 375px phone", () => {
  test.use({ storageState: authFile("admin"), viewport: { width: 375, height: 812 } });

  test("has no horizontal page scroll; wide tables scroll in their own box", async ({ page }) => {
    await openReports(page);
    const page375 = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      outside: [...document.querySelectorAll("main > *")]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.left < -1 || r.right > window.innerWidth + 1).length,
    }));
    expect(page375).toEqual({ overflow: 0, outside: 0 });

    const table = page.getByRole("region", { name: "جدول المالية" });
    expect(await table.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

    // Charts are drawn at the width they get (the viewBox follows the container).
    const chart = page.getByTestId("section-pipeline").getByRole("img").first();
    const box = await chart.boundingBox();
    expect(box?.width).toBeGreaterThan(200);
    expect(box?.width).toBeLessThanOrEqual(375);
    await expect(chart).toHaveAttribute("viewBox", `0 0 ${Math.round(box?.width ?? 0)} ${Math.round(box?.height ?? 0)}`);
  });
});

test.describe("outside the organisation", () => {
  test.use({ storageState: authFile("outsider") });

  test("sees no organisation data", async ({ page }) => {
    await openReports(page);
    await expect(page.getByText("التقارير متاحة لأعضاء المنظمة", { exact: false })).toBeVisible();
    await expect(page.getByTestId("section-pipeline")).toHaveCount(0);
    await expectNoText(page, QA.project);
  });
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/reports asks for a login", async ({ page }) => {
    await page.goto("/reports");
    await expect(page).toHaveURL(/\/login\?next=(%2F|\/)reports$/);
  });
});
