import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { localSupabase } from "./support/local-supabase";
import { authFile, readSeed } from "./support/qa";

// Management summary (Workflow F) as real users, with the deterministic mock AI provider. A dedicated project
// carries known problems (overdue and blocked tasks, a late RFQ close to the event, an overdue invoice, a
// high-impact issue, a mandatory requirement due soon). Each user sees the facts their access allows: finance
// only with finance access, projects only when they are on them. AI recommendations cite the facts they rest
// on, are checked against them, and stay private to their author.
//   E2E_NAMESPACE=summary E2E_PORT=3210 npx playwright test e2e/summary.spec.ts

test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);
const PROJECT = `QA SUMMARY ${run}`;
const INVOICE = `QA-SUM-${run}`;
let projectId = "";

function db() {
  const env = localSupabase();
  return createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** A date in Riyadh (the organisation's time zone), offset by whole days. */
function riyadh(offsetDays: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Sunday of the current week in Riyadh, offset by whole weeks. */
function sunday(offsetWeeks: number): string {
  const dow = new Date(`${riyadh(0)}T00:00:00Z`).getUTCDay();
  return riyadh(-dow + 7 * offsetWeeks);
}

async function cleanUp() {
  const client = db();
  const { organizationId } = readSeed();
  await client.from("management_snapshots").delete().eq("organization_id", organizationId);
  await client.from("ai_findings").delete().eq("organization_id", organizationId).eq("workflow", "management");
  // So the duplicate guard never holds back a rerun with the same figures.
  await client.from("ai_usage_logs").delete().eq("organization_id", organizationId).eq("feature", "management_brief");
  await client.from("proposals").delete().eq("organization_id", organizationId).like("title", "QA SUMMARY %");
  await client.from("projects").delete().eq("organization_id", organizationId).like("name", "QA SUMMARY %");
}

test.beforeAll(async () => {
  await cleanUp();
  const client = db();
  const { organizationId, userIds } = readSeed();
  // Every fixture row is selected with its id; that is all the setup needs back.
  const must = (res: { data: unknown; error: { message: string } | null }, what: string) => {
    if (res.error || res.data == null) throw new Error(`Summary fixtures failed (${what}): ${res.error?.message}`);
    return res.data as { id: string };
  };
  const by = userIds.admin;
  const project = must(await client.from("projects").insert({
    organization_id: organizationId, name: PROJECT, status: "confirmed", project_type: "corporate_event", budget: 50000,
    start_date: riyadh(7), created_by: by,
  }).select("id").single(), "project");
  projectId = project.id;
  must(await client.from("project_members").insert([
    { project_id: projectId, user_id: userIds.sales, role: "editor" },
    { project_id: projectId, user_id: userIds.finance, role: "viewer" },
  ]).select("project_id"), "members");
  must(await client.from("tasks").insert([
    { project_id: projectId, title: "QA summary overdue 1", status: "todo", due_date: riyadh(-4), created_by: by },
    { project_id: projectId, title: "QA summary overdue 2", status: "in_progress", due_date: riyadh(-2), created_by: by },
    { project_id: projectId, title: "QA summary blocked", status: "blocked", due_date: null, created_by: by },
  ]).select("id"), "tasks");
  const rfq = must(await client.from("rfqs").insert({ project_id: projectId, title: "QA summary staging", status: "sent", due_date: riyadh(-1), created_by: by }).select("id").single(), "rfq");
  must(await client.from("quotes").insert({ rfq_id: rfq.id, project_id: projectId, supplier_name: "QA Staging Co", amount: 8000, created_by: by }).select("id"), "quote");
  must(await client.from("invoices").insert({ project_id: projectId, number: INVOICE, amount: 12345, status: "sent", due_date: riyadh(-6), created_by: by }).select("id"), "invoice");
  must(await client.from("project_risks").insert({ project_id: projectId, organization_id: organizationId, kind: "issue", title: "QA summary power supply", impact: "high", created_by: by }).select("id"), "risk");
  must(await client.from("project_requirements").insert({ project_id: projectId, organization_id: organizationId, title: "QA summary bank guarantee", due_date: riyadh(2), created_by: by }).select("id"), "requirement");
  must(await client.from("proposals").insert({ organization_id: organizationId, title: `QA SUMMARY proposal ${run}`, status: "under_review", owner_id: by, created_by: by }).select("id"), "proposal");
  // Last week's snapshot for the admin: no overdue tasks and no high risks then.
  must(await client.from("management_snapshots").insert({
    organization_id: organizationId, user_id: by, week_start: sunday(-1), facts: { "tasks.overdue": 0, "risks.high": 0 },
  }).select("id"), "snapshot");
});

test.afterAll(cleanUp);

test.describe("the organisation admin", () => {
  test.use({ storageState: authFile("admin") });

  test("1. sees every section from live data, finance included, with rule-based suggestions", async ({ page }) => {
    await page.goto("/projects");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Summary" }).click();
    await expect(page).toHaveURL(/\/summary$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ملخص الإدارة الأسبوعي");
    await expect(page.getByTestId("summary-legend")).toContainText("حقيقة");
    await expect(page.getByTestId("summary-legend")).toContainText("تقدير");
    await expect(page.getByTestId("summary-legend")).toContainText("توصية");

    // The overdue total is exactly what the database holds for the organisation (the admin sees every project).
    const { organizationId } = readSeed();
    const { count } = await db().from("tasks").select("id, projects!inner(organization_id)", { count: "exact", head: true })
      .eq("projects.organization_id", organizationId).neq("status", "done").lt("due_date", riyadh(0));
    await expect(page.getByTestId("fact-tasks.overdue")).toHaveAttribute("data-value", String(count));

    // Change since last week's snapshot: worse (red) for overdue work; facts the snapshot lacked show none.
    await expect(page.getByTestId("snapshot-note")).toContainText("مقارنةً بلقطة أسبوع");
    await expect(page.getByTestId("delta-tasks.overdue")).toHaveAttribute("data-delta", String(count));
    await expect(page.getByTestId("delta-tasks.overdue")).toContainText(`+${count}`);
    await expect(page.getByTestId("delta-tasks.overdue")).toHaveClass(/text-red-300/);
    await expect(page.getByTestId("delta-tasks.blocked")).toHaveCount(0);
    await expect(page.getByTestId("delta-finance.overdue_amount")).toHaveCount(0);
    // This week's snapshot is recorded after the page renders, from server-side figures, without finance.
    await expect.poll(async () => {
      const { data } = await db().from("management_snapshots").select("facts").eq("organization_id", organizationId)
        .eq("user_id", readSeed().userIds.admin).eq("week_start", sunday(0)).maybeSingle();
      return data?.facts as Record<string, number> | undefined;
    }).toMatchObject({ "tasks.overdue": count });
    const { data: snap } = await db().from("management_snapshots").select("facts").eq("organization_id", organizationId)
      .eq("user_id", readSeed().userIds.admin).eq("week_start", sunday(0)).single();
    expect(Object.keys(snap!.facts as object).some((k) => k.startsWith("finance."))).toBe(false);

    const ours = page.getByTestId("overdue-by-project").getByRole("listitem").filter({ hasText: PROJECT });
    await expect(ours).toHaveAttribute("data-count", "2");
    await expect(ours.getByRole("link")).toHaveAttribute("href", `/projects/${projectId}/tasks`);
    const rfq = page.getByTestId("open-rfqs").getByRole("listitem").filter({ hasText: "QA summary staging" });
    await expect(rfq).toContainText("تجاوز موعد الرد");
    await expect(rfq).toContainText("الفعالية خلال ثلاثة أسابيع");
    await expect(rfq).toContainText("عروض مسعّرة: 1");
    await expect(page.getByTestId("high-risks")).toContainText("QA summary power supply");
    await expect(page.getByTestId("requirements-due")).toContainText("QA summary bank guarantee");
    await expect(page.getByTestId("proposals-under-review")).toContainText(`QA SUMMARY proposal ${run}`);

    const invoice = page.getByTestId("overdue-invoices").getByRole("listitem").filter({ hasText: INVOICE });
    await expect(invoice).toContainText("SAR 12,345");
    await expect(invoice).toContainText("متأخرة 6 أيام");
    await expect(page.getByTestId("restricted")).toHaveCount(0);

    const suggestions = page.getByTestId("rule-suggestions");
    await expect(suggestions.locator('[data-id="collect-overdue"]')).toBeVisible();
    await expect(suggestions.locator('[data-id="rfqs"]')).toContainText("بلا ترسية والفعالية خلال ثلاثة أسابيع");
    await expect(suggestions.getByTestId("suggestion").first()).toHaveAttribute("data-id", "collect-overdue");
  });

  test("2. AI recommendations cite the facts, are checked against them, and await a decision", async ({ page }) => {
    await page.goto("/summary");
    await page.waitForLoadState("networkidle");
    const panel = page.getByTestId("management-brief");
    await expect(panel).toContainText("وضع تجريبي");
    await panel.getByRole("button", { name: "اقتراح توصيات من هذه البيانات" }).click();
    await expect(panel.getByRole("status")).toContainText(/أُضيفت 3 توصية للمراجعة، منها 3 أرقامها مطابقة لبيانات النظام/);

    const findings = page.getByTestId("ai-findings");
    await expect(findings.getByRole("heading", { name: "توصية (3)" })).toBeVisible();
    const collect = findings.getByTestId("finding").filter({ hasText: "قيمة الفواتير المتأخرة" });
    await expect(collect).toContainText("الحقائق التي استندت إليها (وقت التوليد)");
    await expect(collect).toContainText("كل رقم فيها موجود في بيانات النظام");
    await collect.getByRole("button", { name: /^اعتماد/ }).click();
    await expect(collect).toHaveCount(0);

    const rfqs = findings.getByTestId("finding").filter({ hasText: "بلا ترسية" });
    await rfqs.getByLabel("ملاحظة المراجعة").fill("Awarded by phone today");
    await rfqs.getByRole("button", { name: /^رفض/ }).click();
    await expect(rfqs).toHaveCount(0);
    await findings.getByText("تمت مراجعتها (2)").click();
    await expect(findings.getByTestId("reviewed-finding").filter({ hasText: "Awarded by phone today" })).toContainText("مرفوض");

    // Stored as the admin's own management findings, finance-only because finance figures were among the facts.
    const { userIds } = readSeed();
    const { data } = await db().from("ai_findings").select("status, finance_only, created_by, source_verified, data")
      .eq("organization_id", readSeed().organizationId).eq("workflow", "management");
    expect(data).toHaveLength(3);
    for (const f of data!) {
      expect(f).toMatchObject({ finance_only: true, created_by: userIds.admin, source_verified: true });
      expect((f.data as { fact_ids: string[] }).fact_ids.length).toBeGreaterThan(0);
    }
  });
});

test.describe("a sales editor on the project (no finance, no management role)", () => {
  test.use({ storageState: authFile("sales") });

  test("3. sees the project's facts but no finance figures, quote counts or AI briefs", async ({ page }) => {
    await page.goto("/summary");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("overdue-by-project").getByRole("listitem").filter({ hasText: PROJECT })).toHaveAttribute("data-count", "2");
    await expect(page.getByTestId("restricted")).toContainText("المؤشرات المالية");
    await expect(page.getByTestId("snapshot-note")).toContainText("تُحفظ لقطة من أرقامك");
    await expect(page.getByTestId("summary-section-finance")).toHaveCount(0);
    await expect(page.getByTestId("fact-finance.overdue_amount")).toHaveCount(0);
    await expect(page.getByTestId("open-rfqs").getByRole("listitem").filter({ hasText: "QA summary staging" })).not.toContainText("عروض مسعّرة");
    await expect(page.getByTestId("rule-suggestions").locator('[data-id="collect-overdue"]')).toHaveCount(0);
    await expect(page.getByTestId("management-brief")).toHaveCount(0);
    await expect(page.getByTestId("ai-findings")).toHaveCount(0);
    expect(await page.content()).not.toContain(INVOICE);
  });
});

test.describe("a project manager who is not on the project", () => {
  test.use({ storageState: authFile("pm") });

  test("4. may ask for briefs, but sees neither that project's facts nor the admin's recommendations", async ({ page }) => {
    await page.goto("/summary");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("management-brief")).toBeVisible();
    await expect(page.getByText(PROJECT)).toHaveCount(0);
    await expect(page.getByTestId("ai-findings")).toContainText("لا توصيات بانتظار قرارك");
    await expect(page.getByTestId("ai-findings").getByTestId("finding")).toHaveCount(0);
    await expect(page.getByTestId("ai-findings").getByTestId("reviewed-finding")).toHaveCount(0);
  });
});
