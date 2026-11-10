import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { localSupabase } from "./support/local-supabase";
import { authFile, readSeed } from "./support/qa";

// Supplier quote comparison and the human award (Workflow D), as real users.
//   E2E_NAMESPACE=quotes E2E_PORT=3208 npx playwright test e2e/quote-comparison.spec.ts
// Creates its own RFQ (title starts with "QA compare ") and removes it before and after, so other specs'
// figures (the reports count RFQs and quotes) are unaffected.

test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);
const RFQ = `QA compare ${run}`;

function db() {
  const env = localSupabase();
  return createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function cleanUp() {
  const client = db();
  const { projectId } = readSeed();
  const { data } = await client.from("rfqs").select("id").eq("project_id", projectId).like("title", "QA compare %");
  const ids = (data ?? []).map((r) => r.id as string);
  if (ids.length) {
    await client.from("quotes").delete().in("rfq_id", ids);
    await client.from("rfqs").delete().in("id", ids);
  }
}

test.beforeAll(async () => {
  await cleanUp();
  const client = db();
  const { projectId, userIds } = readSeed();
  const { data: rfq, error } = await client.from("rfqs")
    .insert({ project_id: projectId, title: RFQ, status: "sent", created_by: userIds.admin }).select("id").single();
  if (error || !rfq) throw new Error(`rfq: ${error?.message}`);
  const q = await client.from("quotes").insert([
    { rfq_id: rfq.id, project_id: projectId, supplier_name: "QA Alpha", amount: 50000, status: "received", created_by: userIds.admin,
      scope_basis: "supply_install", valid_until: "2099-12-31", lead_time_days: 10, payment_terms: "30% advance", exclusions: "" },
    { rfq_id: rfq.id, project_id: projectId, supplier_name: "QA Bravo", amount: 42000, status: "received", created_by: userIds.admin,
      scope_basis: "supply_install", valid_until: "2020-01-31", lead_time_days: 5, payment_terms: "on delivery", exclusions: "" },
    { rfq_id: rfq.id, project_id: projectId, supplier_name: "QA Charlie", amount: 45000, status: "received", created_by: userIds.admin,
      scope_basis: "supply_install", valid_until: "2099-06-30", lead_time_days: 14, payment_terms: "", exclusions: "Power supply" },
  ]);
  if (q.error) throw new Error(`quotes: ${q.error.message}`);
});

test.afterAll(cleanUp);

async function openRfq(page: Page) {
  await page.goto(`/projects/${readSeed().projectId}/procurement`);
  await page.waitForLoadState("networkidle");
  return page.getByTestId("rfq").filter({ hasText: RFQ });
}

test.describe("a finance viewer", () => {
  test.use({ storageState: authFile("finance") });

  test("1. sees a like-for-like comparison with flags and a labelled recommendation, but cannot award", async ({ page }) => {
    const card = await openRfq(page);
    const rec = card.getByTestId("recommendation");
    await expect(rec).toContainText("توصية آلية");
    await expect(rec).toContainText("الأنسب: QA Charlie");
    await expect(rec).toContainText("العرض الأرخص (QA Bravo) مستبعد: انتهت صلاحية العرض");
    const bravo = card.getByTestId("quote-row").filter({ hasText: "QA Bravo" });
    await expect(bravo).toContainText("الأقل");
    await expect(bravo).toContainText("انتهت صلاحية العرض");
    await expect(card.getByTestId("quote-row").filter({ hasText: "QA Charlie" })).toContainText("يستثني: Power supply");
    await expect(card.getByRole("button", { name: /^ترسية على/ })).toHaveCount(0);
  });
});

test.describe("the organisation admin (finance + project owner)", () => {
  test.use({ storageState: authFile("admin") });

  test("2. completes a quote's details, then awards with a reason; the decision is recorded", async ({ page }) => {
    const card = await openRfq(page);
    await card.getByRole("button", { name: "تفاصيل عرض QA Charlie" }).click();
    const form = card.getByRole("form", { name: "تفاصيل عرض QA Charlie" });
    await form.getByLabel("شروط الدفع").fill("50% advance, 50% on completion");
    await form.getByRole("button", { name: "حفظ التفاصيل" }).click();
    await expect(card.getByTestId("quote-row").filter({ hasText: "QA Charlie" })).toContainText("50% advance");

    await card.getByRole("button", { name: "ترسية على QA Charlie" }).click();
    const award = card.getByRole("group", { name: "ترسية على QA Charlie" });
    await expect(award.getByRole("button", { name: "تأكيد الترسية" })).toBeDisabled();
    await award.getByLabel("سبب الترسية").fill("Lowest valid quote, delivery in time");
    await award.getByRole("button", { name: "تأكيد الترسية" }).click();

    const record = card.getByTestId("award-record");
    await expect(record).toContainText("رُسّي على QA Charlie");
    await expect(record).toContainText("بواسطة admin@");
    await expect(record).toContainText("Lowest valid quote, delivery in time");
    await expect(card.getByTestId("quote-row").filter({ hasText: "QA Alpha" })).toContainText("(مستبعد)");
    await expect(card.getByText("تمت الترسية").first()).toBeVisible();
  });
});

test.describe("a project editor without finance access (sales)", () => {
  test.use({ storageState: authFile("sales") });

  test("3. sees that quotes are restricted and no prices at all", async ({ page }) => {
    const card = await openRfq(page);
    await expect(card.getByTestId("quotes-restricted")).toBeVisible();
    await expect(card.getByTestId("quote-comparison")).toHaveCount(0);
    expect(await page.content()).not.toContain("45,000");
  });
});
