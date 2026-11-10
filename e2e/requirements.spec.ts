import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { localSupabase } from "./support/local-supabase";
import { authFile, readSeed } from "./support/qa";

// Tender intelligence (Workflow A) as real users, with the deterministic mock AI provider: a real text PDF
// is analysed page by page, findings show verified sources, accepted findings become register rows with
// owners, evidence and due dates, and the due date reaches the calendar.
//   E2E_NAMESPACE=requirements E2E_PORT=3207 npx playwright test e2e/requirements.spec.ts

test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);
const TITLE = `QA tender ${run}`;
let documentId = "";
let storagePath = "";

function db() {
  const env = localSupabase();
  return createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function cleanUp() {
  const client = db();
  const { projectId } = readSeed();
  await client.from("project_requirements").delete().eq("project_id", projectId);
  await client.from("ai_findings").delete().eq("project_id", projectId).eq("workflow", "tender");
  const { data: docs } = await client.from("documents").select("id, storage_path").eq("project_id", projectId).like("title", "QA tender %");
  if (docs?.length) {
    await client.storage.from("documents").remove(docs.map((d) => d.storage_path as string));
    await client.from("documents").delete().in("id", docs.map((d) => d.id as string));
  }
}

test.beforeAll(async ({ browser }) => {
  await cleanUp();
  // A three-page tender PDF with a real text layer, made by the browser itself.
  const page = await browser.newPage();
  await page.setContent(`<html><body style="font-family: sans-serif">
    <section style="page-break-after: always"><p>General conditions of the event tender for the national day celebration.</p></section>
    <section style="page-break-after: always"><p>Bidders must submit a valid commercial registration certificate.</p><p>The submission deadline is 2027-03-15 at noon.</p></section>
    <section><p>A bid bond of 2% of the offer value is required.</p><p>The closing date is 2027-03-20.</p></section>
  </body></html>`);
  const pdf = await page.pdf({ format: "A4" });
  await page.close();

  const { organizationId, projectId, userIds } = readSeed();
  documentId = randomUUID();
  storagePath = `${organizationId}/${projectId}/${documentId}/tender.pdf`;
  const client = db();
  const up = await client.storage.from("documents").upload(storagePath, pdf, { contentType: "application/pdf" });
  if (up.error) throw new Error(`upload failed: ${up.error.message}`);
  const ins = await client.from("documents").insert({
    id: documentId, organization_id: organizationId, project_id: projectId, title: TITLE, category: "rfp",
    storage_path: storagePath, file_name: "tender.pdf", mime_type: "application/pdf", size_bytes: pdf.length, created_by: userIds.admin,
  });
  if (ins.error) throw new Error(`document row failed: ${ins.error.message}`);
});

test.afterAll(cleanUp);

test.describe("a project editor (sales)", () => {
  test.use({ storageState: authFile("sales") });

  test("1. analyses the tender PDF: findings arrive for review with verified page sources", async ({ page }) => {
    const { projectId } = readSeed();
    await page.goto(`/projects/${projectId}/requirements`);
    await page.waitForLoadState("networkidle");
    const panel = page.getByTestId("tender-analysis");
    await expect(panel).toContainText("وضع تجريبي");
    await panel.getByLabel("ملف الكراسة").selectOption({ label: TITLE });
    await panel.getByRole("button", { name: "تحليل الكراسة" }).click();
    await expect(panel.getByRole("status")).toContainText(/أُضيفت \d+ نتيجة للمراجعة/);

    const findings = page.getByTestId("ai-findings");
    const registration = findings.getByTestId("finding").filter({ hasText: "commercial registration" });
    await expect(registration).toContainText("صفحة 2");
    await expect(registration).toContainText("المصدر مُتحقَّق منه");
    await expect(registration).toContainText("Bidders must submit a valid commercial registration certificate");
    await expect(findings.getByTestId("finding").filter({ hasText: "موعدان مختلفان" })).toBeVisible();
    await expect(findings.getByRole("button", { name: "نسخ السؤال" })).toBeVisible();
  });

  test("2. accepted findings become register rows; a rejected one is recorded with its reviewer", async ({ page }) => {
    const { projectId } = readSeed();
    await page.goto(`/projects/${projectId}/requirements`);
    await page.waitForLoadState("networkidle");
    const findings = page.getByTestId("ai-findings");
    await findings.getByTestId("finding").filter({ hasText: "commercial registration" })
      .getByRole("button", { name: /^إضافة إلى السجل/ }).click();
    const register = page.getByTestId("requirements-register");
    const row = register.getByTestId("requirement").filter({ hasText: "commercial registration" });
    await expect(row).toContainText("من التحليل");
    await expect(row).toContainText(`${TITLE} · صفحة 2`);

    await findings.getByTestId("finding").filter({ hasText: "submission deadline is 2027-03-15" })
      .getByRole("button", { name: /^إضافة إلى السجل/ }).click();
    await expect(register.getByTestId("requirement").filter({ hasText: "2027-03-15" })).toBeVisible();

    const conflict = findings.getByTestId("finding").filter({ hasText: "موعدان مختلفان" });
    await conflict.getByLabel("ملاحظة المراجعة").fill("Addendum fixes the date");
    await conflict.getByRole("button", { name: /^رفض/ }).click();
    await findings.getByText(/تمت مراجعتها \(\d+\)/).click();
    const reviewed = findings.getByTestId("reviewed-finding").filter({ hasText: "موعدان مختلفان" });
    await expect(reviewed).toContainText("مرفوض");
    await expect(reviewed).toContainText("Addendum fixes the date");
  });

  test("3. the editor assigns an owner, links evidence and marks it met; compliance updates", async ({ page }) => {
    const { projectId } = readSeed();
    await page.goto(`/projects/${projectId}/requirements`);
    await page.waitForLoadState("networkidle");
    const register = page.getByTestId("requirements-register");
    const row = register.getByTestId("requirement").filter({ hasText: "commercial registration" });
    await row.getByRole("combobox", { name: /^مسؤول/ }).selectOption({ index: 1 });
    await row.getByRole("combobox", { name: /^مستند/ }).selectOption({ label: TITLE });
    await row.getByRole("combobox", { name: /^حالة/ }).selectOption("met");
    await expect(row.getByRole("combobox", { name: /^حالة/ })).toHaveValue("met");
    await expect(page.getByTestId("compliance-summary")).toContainText("1/2");
    await expect(row).not.toContainText("بلا مستند داعم");
  });

  test("4. the requirement's due date appears in the calendar and links back to the register", async ({ page }) => {
    await page.goto("/calendar?view=agenda&date=2027-03-01");
    await page.waitForLoadState("networkidle");
    const item = page.getByTestId("agenda-list").getByRole("link", { name: /2027-03-15/ });
    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute("href", /\/requirements$/);
  });
});

test.describe("a project viewer", () => {
  test.use({ storageState: authFile("viewer") });

  test("5. reads the register and findings but cannot analyse, review or edit", async ({ page }) => {
    const { projectId } = readSeed();
    await page.goto(`/projects/${projectId}/requirements`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("requirements-register").getByTestId("requirement").first()).toBeVisible();
    await expect(page.getByTestId("tender-analysis")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^إضافة إلى السجل/ })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: /^حالة/ })).toHaveCount(0);
  });
});
