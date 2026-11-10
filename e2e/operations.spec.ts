import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { localSupabase } from "./support/local-supabase";
import { authFile, QA, readSeed } from "./support/qa";

// Event operations (Workflow E) as real users, with the deterministic mock AI provider: an editor writes a
// venue inspection report, the AI proposes action items, issues, risks and decisions quoted from the report,
// an accepted action item becomes a task assigned to the suggested project member, accepted issues and risks
// join the risk log with a link back to the report, and a viewer can read everything but change nothing.
//   E2E_NAMESPACE=operations E2E_PORT=3209 npx playwright test e2e/operations.spec.ts

test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);
const TITLE = `QA ops inspection ${run}`;
const MANUAL_RISK = `QA ops generator fuel ${run}`;
// Each sentence trips exactly one rule of the mock provider (see mockOpsOutput): an issue, a risk, a decision,
// an action item with an owner who is a project member and a date, and one whose owner is not a member.
const BODY = [
  "The loading dock door is broken and blocks deliveries.",
  "Rain could flood the outdoor registration area on the event day.",
  "The client approved the revised stage position.",
  "Ops will install the wayfinding signs by 2027-02-10.",
  "The caterer must confirm the final headcount.",
].join("\n");
const TASK_TITLE = "[اختبار] Ops will install the wayfinding signs by 2027-02-10.";
let reportUrl = "";

function db() {
  const env = localSupabase();
  return createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function cleanUp() {
  const client = db();
  const { projectId } = readSeed();
  await client.from("ai_findings").delete().eq("project_id", projectId).eq("workflow", "operations");
  await client.from("project_risks").delete().eq("project_id", projectId).like("title", "QA ops %");
  await client.from("project_risks").delete().eq("project_id", projectId).like("title", "[اختبار]%");
  await client.from("tasks").delete().eq("project_id", projectId).like("title", "[اختبار]%");
  await client.from("ops_reports").delete().eq("project_id", projectId).like("title", "QA ops %");
}

test.beforeAll(cleanUp);
test.afterAll(cleanUp);

test.describe("a project editor (sales)", () => {
  test.use({ storageState: authFile("sales") });

  test("1. writes a venue inspection report and edits it", async ({ page }) => {
    const { projectId } = readSeed();
    await page.goto(`/projects/${projectId}/operations`);
    await page.waitForLoadState("networkidle");
    const form = page.getByRole("form", { name: "تقرير جديد" });
    await form.getByLabel("النوع").selectOption("venue_inspection");
    await form.getByLabel("العنوان").fill(TITLE);
    await form.getByLabel("الموقع").fill("Hall A");
    await form.getByLabel("الحضور").fill("Ops lead, client");
    await form.getByLabel("الملاحظات").fill(BODY);
    await form.getByRole("button", { name: "إنشاء التقرير" }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/operations/[0-9a-f-]{36}$`));
    reportUrl = new URL(page.url()).pathname;

    const edit = page.getByRole("form", { name: "تعديل التقرير" });
    await expect(edit.getByLabel("العنوان")).toHaveValue(TITLE);
    await edit.getByLabel("الموقع").fill("Hall B");
    await edit.getByRole("button", { name: "حفظ التقرير" }).click();
    await expect(edit.getByRole("status")).toContainText("حُفظ التقرير.");
    await expect(page.getByRole("navigation", { name: "مسار التقرير" })).toContainText("معاينة المكان");
  });

  test("2. extracts findings quoted from the report, with a suggested assignee; a repeat run is held back", async ({ page }) => {
    await page.goto(reportUrl);
    await page.waitForLoadState("networkidle");
    const panel = page.getByTestId("ops-extract");
    await expect(panel).toContainText("وضع تجريبي");
    await panel.getByRole("button", { name: "استخراج من التقرير" }).click();
    await expect(panel.getByRole("status")).toContainText("أُضيفت 5 نتيجة للمراجعة، منها 5 بنص مُتحقَّق منه في التقرير.");

    const findings = page.getByTestId("ai-findings");
    for (const heading of ["إجراء مطلوب (2)", "مشكلة (1)", "خطر (1)", "قرار (1)"]) {
      await expect(findings.getByRole("heading", { name: heading })).toBeVisible();
    }
    const signs = findings.getByTestId("finding").filter({ hasText: "wayfinding signs" });
    await expect(signs).toContainText(`المسؤول المقترح: ${QA.users.ops}`);
    await expect(signs).toContainText("الموعد: 2027-02-10");
    await expect(signs).toContainText("نص التقرير");
    await expect(signs).toContainText("المصدر مُتحقَّق منه");
    await expect(signs).toContainText("“Ops will install the wayfinding signs by 2027-02-10.”");
    // Nobody in the project matches "caterer", so no assignee is suggested.
    await expect(findings.getByTestId("finding").filter({ hasText: "caterer" })).not.toContainText("المسؤول المقترح");

    // The same report text again within the duplicate window: no second paid run without an explicit choice.
    await panel.getByRole("button", { name: "استخراج من التقرير" }).click();
    await expect(panel.getByRole("alert")).toBeVisible();
    await expect(panel.getByLabel("إعادة الاستخراج رغم التطابق")).toBeVisible();
    await expect(findings.getByTestId("finding")).toHaveCount(5);
  });

  test("3. an accepted action item becomes a task assigned to the suggested member, with its due date", async ({ page }) => {
    const { projectId, userIds } = readSeed();
    await page.goto(reportUrl);
    await page.waitForLoadState("networkidle");
    const findings = page.getByTestId("ai-findings");
    await findings.getByTestId("finding").filter({ hasText: "wayfinding signs" }).getByRole("button", { name: /^إنشاء مهمة/ }).click();
    await expect(findings.getByTestId("finding").filter({ hasText: "wayfinding signs" })).toHaveCount(0);

    // The database holds the task and the decision trail: who accepted, and which task it became.
    const { data: tasks } = await db().from("tasks").select("id, assignee_id, due_date, priority, status").eq("project_id", projectId).eq("title", TASK_TITLE);
    expect(tasks).toHaveLength(1);
    expect(tasks![0]).toMatchObject({ assignee_id: userIds.ops, due_date: "2027-02-10", priority: "normal", status: "todo" });
    const { data: finding } = await db().from("ai_findings").select("status, target_table, target_id, reviewed_by").eq("project_id", projectId).eq("title", TASK_TITLE).single();
    expect(finding).toMatchObject({ status: "accepted", target_table: "tasks", target_id: tasks![0].id, reviewed_by: userIds.sales });

    await page.goto(`/projects/${projectId}/tasks`);
    await page.waitForLoadState("networkidle");
    const card = page.getByTestId("task-card").filter({ hasText: "wayfinding signs" });
    // The meta line under the title: assignee (e-mail local part), then the due date.
    await expect(card.locator("p").nth(1)).toContainText(/^ops/);
    await expect(card.locator("p").nth(1)).toContainText("Due 10 Feb 2027");
  });

  test("4. issues and risks join the log; a rejected item keeps the reviewer's note; a decision is acknowledged", async ({ page }) => {
    await page.goto(reportUrl);
    await page.waitForLoadState("networkidle");
    const findings = page.getByTestId("ai-findings");
    await findings.getByTestId("finding").filter({ hasText: "Rain could flood" }).getByRole("button", { name: /^إضافة إلى السجل/ }).click();
    await expect(findings.getByTestId("finding").filter({ hasText: "Rain could flood" })).toHaveCount(0);
    await findings.getByTestId("finding").filter({ hasText: "loading dock door" }).getByRole("button", { name: /^إضافة إلى السجل/ }).click();
    await expect(findings.getByTestId("finding").filter({ hasText: "loading dock door" })).toHaveCount(0);

    const caterer = findings.getByTestId("finding").filter({ hasText: "caterer" });
    await caterer.getByLabel("ملاحظة المراجعة").fill("Caterer confirmed by phone");
    await caterer.getByRole("button", { name: /^رفض/ }).click();
    await expect(caterer).toHaveCount(0);
    await findings.getByTestId("finding").filter({ hasText: "approved the revised stage" }).getByRole("button", { name: /^اعتماد/ }).click();
    await expect(findings).toContainText("لا نتائج بانتظار المراجعة");

    await findings.getByText("تمت مراجعتها (5)").click();
    const rejected = findings.getByTestId("reviewed-finding").filter({ hasText: "caterer" });
    await expect(rejected).toContainText("مرفوض");
    await expect(rejected).toContainText("Caterer confirmed by phone");
    await expect(rejected).toContainText(QA.users.sales);
    await expect(findings.getByTestId("reviewed-finding").filter({ hasText: "مقبول" })).toHaveCount(4);

    await page.getByRole("navigation", { name: "مسار التقرير" }).getByRole("link", { name: "العمليات" }).click();
    await page.waitForLoadState("networkidle");
    const log = page.getByTestId("risk-log");
    await expect(log).toContainText("1 مشكلة مفتوحة · 1 خطر مفتوح");
    const risk = log.getByTestId("risk").filter({ hasText: "Rain could flood" });
    await expect(risk).toContainText("الاحتمال: متوسط");
    await expect(risk.getByRole("link", { name: `المصدر: ${TITLE}` })).toHaveAttribute("href", reportUrl);
    await expect(log.getByTestId("risk").filter({ hasText: "loading dock door" })).toContainText("الأثر: مرتفع");
  });

  test("5. the editor assigns and progresses log items, adds one by hand and closes it", async ({ page }) => {
    const { projectId, userIds } = readSeed();
    await page.goto(`/projects/${projectId}/operations`);
    await page.waitForLoadState("networkidle");
    const log = page.getByTestId("risk-log");
    const issue = log.getByTestId("risk").filter({ hasText: "loading dock door" });
    await issue.getByRole("combobox", { name: /^مسؤول/ }).selectOption({ label: QA.users.ops });
    await expect(issue.getByRole("combobox", { name: /^مسؤول/ })).toHaveValue(userIds.ops);
    await issue.getByRole("combobox", { name: /^حالة/ }).selectOption("mitigating");
    await expect(issue.getByRole("combobox", { name: /^حالة/ })).toHaveValue("mitigating");
    const { data: row } = await db().from("project_risks").select("owner_id, status, source_report_id, finding_id").eq("project_id", projectId).like("title", "%loading dock door%").single();
    expect(row).toMatchObject({ owner_id: userIds.ops, status: "mitigating" });
    expect(row!.source_report_id).toBe(reportUrl.split("/").pop());
    expect(row!.finding_id).not.toBeNull();

    await log.getByLabel("النوع").selectOption("risk");
    await log.getByLabel("الوصف").fill(MANUAL_RISK);
    await log.getByLabel("الأثر").selectOption("high");
    await log.getByRole("button", { name: "إضافة" }).click();
    const manual = log.getByTestId("risk").filter({ hasText: MANUAL_RISK });
    await expect(manual).toContainText("الاحتمال: مرتفع");
    await expect(log).toContainText("2 خطر مفتوح");

    await manual.getByRole("combobox", { name: /^حالة/ }).selectOption("closed");
    await expect(manual).toHaveCount(0);
    await log.getByLabel("عرض المغلقة").check();
    await expect(log.getByTestId("risk").filter({ hasText: MANUAL_RISK })).toBeVisible();
  });
});

test.describe("a project viewer", () => {
  test.use({ storageState: authFile("viewer") });

  test("6. reads reports, findings and the log but cannot write, extract, review or edit", async ({ page }) => {
    const { projectId } = readSeed();
    await page.goto(`/projects/${projectId}/operations`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("report-form")).toHaveCount(0);
    const log = page.getByTestId("risk-log");
    await expect(log.getByTestId("risk").filter({ hasText: "Rain could flood" })).toBeVisible();
    await expect(log.getByRole("combobox")).toHaveCount(0);
    await expect(log.getByRole("button", { name: "إضافة" })).toHaveCount(0);

    await page.getByTestId("ops-reports").getByRole("link", { name: new RegExp(TITLE) }).click();
    await expect(page).toHaveURL(new RegExp(`${reportUrl}$`));
    await expect(page.getByTestId("report-view")).toContainText("The caterer must confirm the final headcount.");
    await expect(page.getByTestId("report-view")).toContainText("Hall B");
    await expect(page.getByTestId("ops-extract")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(إنشاء مهمة|إضافة إلى السجل|رفض|اعتماد)/ })).toHaveCount(0);
    await page.getByTestId("ai-findings").getByText("تمت مراجعتها (5)").click();
    await expect(page.getByTestId("reviewed-finding")).toHaveCount(5);
    await expect(page.getByRole("button", { name: /إعادة فتح/ })).toHaveCount(0);
  });
});
