import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { localSupabase } from "./support/local-supabase";
import { authFile, readSeed } from "./support/qa";

// AI BOQ extraction (Workflow B, increment 2) as real users, with the deterministic mock AI provider: a real
// two-page text PDF is read page by page, each extracted line shows its page, its quote and whether the
// quantity appears in that quote, and a line joins the BOQ only when an editor verifies it.
//   E2E_NAMESPACE=boqx E2E_PORT=3211 npx playwright test e2e/boq-extract.spec.ts

test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);
const PROJECT = `QA BOQX ${run}`;
const DOC = `QA BOQX tender ${run}`;
let projectId = "";

function db() {
  const env = localSupabase();
  return createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function cleanUp() {
  const client = db();
  const { organizationId } = readSeed();
  const { data: docs } = await client.from("documents").select("id, storage_path").eq("organization_id", organizationId).like("title", "QA BOQX %");
  if (docs?.length) {
    await client.storage.from("documents").remove(docs.map((d) => d.storage_path as string));
    await client.from("documents").delete().in("id", docs.map((d) => d.id as string));
  }
  await client.from("projects").delete().eq("organization_id", organizationId).like("name", "QA BOQX %");
  await client.from("ai_usage_logs").delete().eq("organization_id", organizationId).eq("feature", "boq_extract");
}

test.beforeAll(async ({ browser }) => {
  await cleanUp();
  const client = db();
  const { organizationId, userIds } = readSeed();
  const project = await client.from("projects").insert({
    organization_id: organizationId, name: PROJECT, status: "lead", project_type: "conference", created_by: userIds.admin,
  }).select("id").single();
  if (project.error) throw new Error(`project failed: ${project.error.message}`);
  projectId = project.data.id as string;
  const members = await client.from("project_members").insert([
    { project_id: projectId, user_id: userIds.sales, role: "editor" },
    { project_id: projectId, user_id: userIds.viewer, role: "viewer" },
  ]);
  if (members.error) throw new Error(`members failed: ${members.error.message}`);

  // A two-page tender with a real text layer, made by the browser itself.
  const page = await browser.newPage();
  await page.setContent(`<html><body style="font-family: sans-serif">
    <section style="page-break-after: always"><p>General conditions of the conference tender. Bidders price every line of the bill of quantities on the next page.</p><p>Prices are excluded from this document and quantities are fixed by the client.</p></section>
    <section><p>Bill of quantities.</p><p>1.1 LED screen 3x2m 2 nos.</p><p>1.2 Truss structure 24 m.</p><p>1.3 Stage carpet as per drawing.</p></section>
  </body></html>`);
  const pdf = await page.pdf({ format: "A4" });
  await page.close();
  const documentId = randomUUID();
  const storagePath = `${organizationId}/${projectId}/${documentId}/boq.pdf`;
  const up = await client.storage.from("documents").upload(storagePath, pdf, { contentType: "application/pdf" });
  if (up.error) throw new Error(`upload failed: ${up.error.message}`);
  const ins = await client.from("documents").insert({
    id: documentId, organization_id: organizationId, project_id: projectId, title: DOC, category: "rfp",
    storage_path: storagePath, file_name: "boq.pdf", mime_type: "application/pdf", size_bytes: pdf.length, created_by: userIds.admin,
  });
  if (ins.error) throw new Error(`document row failed: ${ins.error.message}`);
});

test.afterAll(cleanUp);

test.describe("a project editor (sales)", () => {
  test.use({ storageState: authFile("sales") });

  test("1. extracts the BOQ lines with page, quote and a quantity check for each", async ({ page }) => {
    await page.goto(`/projects/${projectId}/pricing`);
    await page.waitForLoadState("networkidle");
    const panel = page.getByTestId("boq-extract");
    await expect(panel).toContainText("وضع تجريبي");
    await panel.getByLabel("الملف").selectOption({ label: DOC });
    await panel.getByRole("button", { name: "استخراج البنود" }).click();
    await expect(panel.getByRole("status")).toContainText("استُخرج 3 بند للتحقق، منها 2 كميتها موجودة في النص المقتبس.");

    const findings = page.getByTestId("ai-findings");
    await expect(findings.getByRole("heading", { name: "بند كميات (3)" })).toBeVisible();
    const screen = findings.getByTestId("finding").filter({ hasText: "LED screen 3x2m" });
    await expect(screen).toContainText(`${DOC}`);
    await expect(screen).toContainText("صفحة 2");
    await expect(screen).toContainText("البند 1.1 · الكمية: 2 · الوحدة: nos");
    await expect(screen.getByTestId("finding-checks")).toContainText("النص المقتبس موجود في الصفحة");
    await expect(screen.getByTestId("finding-checks")).toContainText("الكمية موجودة في النص المقتبس");
    const carpet = findings.getByTestId("finding").filter({ hasText: "Stage carpet" });
    await expect(carpet.getByTestId("finding-checks")).toContainText("الكمية غير مذكورة في الملف");
    // Nothing reaches the BOQ before a person verifies it.
    await expect(page.getByTestId("pricing")).toContainText("لا توجد بنود بعد.");
  });

  test("2. a verified line joins the BOQ with its source; a rejected one never does", async ({ page }) => {
    const { userIds } = readSeed();
    await page.goto(`/projects/${projectId}/pricing`);
    await page.waitForLoadState("networkidle");
    const findings = page.getByTestId("ai-findings");
    await findings.getByTestId("finding").filter({ hasText: "LED screen 3x2m" }).getByRole("button", { name: /^تحقّقت: أضف إلى الجدول/ }).click();
    const table = page.getByTestId("pricing");
    const row = table.getByRole("row").filter({ hasText: "LED screen 3x2m" });
    await expect(row.getByTestId("boq-source")).toContainText(`مُتحقَّق من الملف · ${DOC} · صفحة 2`);
    await expect(row.getByTestId("boq-description")).toContainText("1.1");
    await expect(row.getByRole("textbox", { name: /^كمية/ })).toHaveValue("2");

    const carpet = findings.getByTestId("finding").filter({ hasText: "Stage carpet" });
    await carpet.getByLabel("ملاحظة المراجعة").fill("Quantity comes with the drawings addendum");
    await carpet.getByRole("button", { name: /^رفض/ }).click();
    await expect(carpet).toHaveCount(0);
    await findings.getByTestId("finding").filter({ hasText: "Truss structure" }).getByRole("button", { name: /^تحقّقت: أضف إلى الجدول/ }).click();
    await expect(table.getByRole("row").filter({ hasText: "Truss structure" }).getByRole("textbox", { name: /^كمية/ })).toHaveValue("24");
    await expect(table.getByRole("row").filter({ hasText: "Stage carpet" })).toHaveCount(0);

    // The database holds the lines and who verified each; accepted findings and BOQ lines point at each other.
    const { data: lines } = await db().from("boq_items").select("id, quantity, unit, item_ref, finding_id, unit_price").eq("project_id", projectId).order("sort_order");
    expect(lines?.map((l) => [l.item_ref, Number(l.quantity), l.unit, l.unit_price])).toEqual([["1.1", 2, "nos", null], ["1.2", 24, "m", null]]);
    const { data: decided } = await db().from("ai_findings").select("id, status, reviewed_by, target_id").eq("project_id", projectId).eq("workflow", "boq").neq("status", "proposed");
    expect(decided).toHaveLength(3);
    for (const f of decided!) expect(f.reviewed_by).toBe(userIds.sales);
    const accepted = decided!.filter((f) => f.status === "accepted");
    expect(accepted.map((f) => f.target_id).sort()).toEqual(lines!.map((l) => l.id).sort());
    expect(lines!.map((l) => l.finding_id).sort()).toEqual(accepted.map((f) => f.id).sort());
  });
});

test.describe("a project viewer", () => {
  test.use({ storageState: authFile("viewer") });

  test("3. sees the verified lines and the decisions but cannot extract or verify", async ({ page }) => {
    await page.goto(`/projects/${projectId}/pricing`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("pricing").getByRole("row").filter({ hasText: "LED screen 3x2m" }).getByTestId("boq-source")).toBeVisible();
    await expect(page.getByTestId("boq-extract")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^تحقّقت: أضف إلى الجدول|^رفض/ })).toHaveCount(0);
    await page.getByTestId("ai-findings").getByText("تمت مراجعتها (3)").click();
    await expect(page.getByTestId("reviewed-finding").filter({ hasText: "Stage carpet" })).toContainText("مرفوض");
  });
});
