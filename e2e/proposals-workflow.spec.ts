import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { localSupabase } from "./support/local-supabase";
import { authFile, readSeed } from "./support/qa";

// Proposal Builder Phase 2 as real users against the local stack, with the deterministic mock
// AI provider (AI_PROVIDER=mock in playwright.config.ts):
//   E2E_NAMESPACE=proposals E2E_PORT=3205 npx playwright test e2e/proposals-workflow.spec.ts
// The spec creates its own template and proposal (names start with "QA P2 ") and removes them
// before and after, so other specs' exact figures (e.g. the reports) are unaffected.

test.describe.configure({ mode: "serial" });

const PREFIX = "QA P2 ";
const run = Date.now().toString(36);
const TEMPLATE = `${PREFIX}template ${run}`;
const TITLE = `${PREFIX}proposal ${run}`;
const BRIEF = "فعالية إطلاق منتج لعميل في الرياض لمدة يومين، مع منصة رئيسية وإضاءة وصوت وضيافة لـ 300 ضيف.";
let proposalPath = "";

async function cleanUp() {
  const env = localSupabase();
  const db = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { organizationId } = readSeed();
  const { data: rows } = await db
    .from("proposals").select("id, project_id").eq("organization_id", organizationId).like("title", `${PREFIX}%`);
  const projects = (rows ?? []).map((r) => r.project_id as string | null).filter((v): v is string => Boolean(v));
  if (rows?.length) await db.from("proposals").delete().in("id", rows.map((r) => r.id as string));
  if (projects.length) await db.from("projects").delete().in("id", projects);
  await db.from("proposal_templates").delete().eq("organization_id", organizationId).like("name", `${PREFIX}%`);
}

/** The organisation's default VAT, which new proposals start with (15 is the seeded value). */
async function setDefaultVat(rate: number) {
  const env = localSupabase();
  const db = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.from("organizations").update({ default_vat_rate: rate }).eq("id", readSeed().organizationId);
  if (error) throw new Error(`default VAT update failed: ${error.message}`);
}

test.beforeAll(async () => {
  await cleanUp();
  await setDefaultVat(5);
});
test.afterAll(async () => {
  await cleanUp();
  await setDefaultVat(15);
});

test.describe("sales drafts and submits", () => {
  test.use({ storageState: authFile("sales") });

  test("1. creates a template and starts a proposal from it", async ({ page }) => {
    await page.goto("/proposals/templates");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "قالب جديد" }).click();
    await page.getByLabel("اسم القالب").fill(TEMPLATE);
    await page.getByLabel("نوع العرض").selectOption("creative_concept");
    const removeButtons = page.getByRole("button", { name: /^حذف القسم \d+$/ });
    while ((await removeButtons.count()) > 2) await removeButtons.last().click();
    await page.getByLabel("عنوان القسم 1").fill("المفهوم الإبداعي");
    await page.getByLabel("توجيه القسم 1").fill("فكرة رئيسية واحدة وقصة الحدث");
    await page.getByLabel("عنوان القسم 2").fill("الميزانية التقديرية");
    await page.getByRole("button", { name: "حفظ القالب" }).click();
    await expect(page.getByText("أُنشئ القالب.")).toBeVisible();
    await expect(page.getByTestId("template-card").filter({ hasText: TEMPLATE })).toContainText("2 قسمًا");

    await page.goto("/proposals");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "عرض جديد" }).click();
    await page.getByLabel("عنوان العرض").fill(TITLE);
    await page.getByLabel("القالب (اختياري)").selectOption({ label: TEMPLATE });
    await expect(page.getByLabel("نوع العرض")).toHaveValue("creative_concept");
    await page.getByRole("button", { name: "إنشاء العرض" }).click();
    await expect(page).toHaveURL(/\/proposals\/[0-9a-f-]{36}$/);
    proposalPath = new URL(page.url()).pathname;
    await expect(page.getByText(`قالب: ${TEMPLATE}`)).toBeVisible();
    await expect(page.locator('input[value="المفهوم الإبداعي"]')).toBeVisible();
    await expect(page.locator('input[value="الميزانية التقديرية"]')).toBeVisible();
    // It starts with the organisation's default VAT, not the built-in 15%.
    await expect(page.getByLabel("نسبة ضريبة القيمة المضافة")).toHaveValue("5");
    await expect(page.getByText("ض.ق.م (5%)")).toBeVisible();
  });

  test("2. drafts with AI, refuses an identical repeat, and keeps a version before replacing", async ({ page }) => {
    await page.goto(proposalPath);
    await page.waitForLoadState("networkidle");
    const ai = page.getByTestId("proposal-ai");
    await expect(ai).toContainText("وضع تجريبي");
    await expect(page.getByTestId("ai-quota")).toContainText(/\d+\/\d+ هذه الساعة/);

    await ai.getByLabel("موجز العميل").fill(BRIEF);
    await ai.getByRole("button", { name: "توليد المسودة" }).click();
    await expect(ai.getByText("تم توليد المسودة ✓")).toBeVisible();
    await expect(page.getByPlaceholder("محتوى القسم…").first()).toHaveValue(/\[مسودة اختبار\].*المفهوم الإبداعي/);
    await expect(page.getByLabel("الملخص التنفيذي")).toHaveValue(/\[مسودة اختبار\]/);

    await ai.getByRole("button", { name: "إعادة التوليد" }).click();
    await expect(ai.getByRole("alert")).toContainText("أُنجز طلب مطابق");
    await ai.getByLabel(/إعادة التوليد رغم التطابق/).check();
    await ai.getByRole("button", { name: "إعادة التوليد" }).click();
    await expect(ai.getByText("تم توليد المسودة ✓")).toBeVisible();
    await expect(page.getByTestId("proposal-history")).toContainText("قبل إعادة التوليد بالذكاء الاصطناعي");
  });

  test("3. submits for review: content locks and approval is not offered to sales", async ({ page }) => {
    await page.goto(proposalPath);
    await page.waitForLoadState("networkidle");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "إرسال للمراجعة الداخلية" }).click();
    await expect(page.getByTestId("proposal-status")).toHaveText("قيد المراجعة");
    await expect(page.getByTestId("proposal-locked")).toBeVisible();
    await expect(page.getByTestId("proposal-ai")).toHaveCount(0);
    await expect(page.getByPlaceholder("محتوى القسم…")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "اعتماد العرض" })).toHaveCount(0);
  });
});

test.describe("the admin reviews", () => {
  test.use({ storageState: authFile("admin") });

  test("4. a change request needs a reason; approval records the approver", async ({ page }) => {
    await page.goto(proposalPath);
    await page.waitForLoadState("networkidle");
    const review = page.getByRole("form", { name: "مراجعة العرض" });
    await review.getByRole("button", { name: "طلب تعديلات" }).click();
    await expect(review.getByRole("alert")).toContainText("اكتب سبب طلب التعديلات");
    await review.getByRole("textbox").fill("ممتاز، معتمد للإرسال.");
    await review.getByRole("button", { name: "اعتماد العرض" }).click();
    await expect(page.getByTestId("proposal-status")).toHaveText("معتمد داخليًا");
    await expect(page.getByTestId("proposal-workflow")).toContainText("اعتمده");
    await expect(page.getByTestId("proposal-history")).toContainText("ممتاز، معتمد للإرسال.");
  });
});

test.describe("sales after approval", () => {
  test.use({ storageState: authFile("sales") });

  test("5. sends it, opens the frozen approved version and its PDF, then converts the accepted proposal", async ({ page }) => {
    await page.goto(proposalPath);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "تحديد كمُرسل للعميل" }).click();
    await expect(page.getByTestId("proposal-status")).toHaveText("أُرسل للعميل");

    await page.getByTestId("proposal-history").getByRole("listitem").filter({ hasText: "معتمد داخليًا" }).getByRole("link").click();
    await expect(page).toHaveURL(/\/versions\/\d+$/);
    await expect(page.getByText("نسخة مجمّدة للقراءة فقط")).toBeVisible();
    await expect(page.getByRole("heading", { name: "المفهوم الإبداعي" })).toBeVisible();
    const pdf = await page.getByRole("link", { name: "PDF لهذه النسخة" }).getAttribute("href");
    await page.goto(pdf as string);
    await expect(page.getByText(/نسخة \d+ \(معتمدة\)/)).toBeVisible();

    await page.goto(proposalPath);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "قبِل العميل" }).click();
    await expect(page.getByTestId("proposal-status")).toHaveText("مقبول");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "تحويل إلى مشروع" }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  });
});

test.describe("a viewer", () => {
  test.use({ storageState: authFile("viewer") });

  test("6. sees the proposal read-only, without workflow actions, comments or AI", async ({ page }) => {
    await page.goto(proposalPath);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("proposal-status")).toHaveText("تحوّل لمشروع");
    await expect(page.getByTestId("proposal-ai")).toHaveCount(0);
    await expect(page.getByTestId("proposal-workflow").getByRole("button")).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "تعليق للفريق" })).toHaveCount(0);
  });
});
