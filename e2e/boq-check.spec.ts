import { createClient } from "@supabase/supabase-js";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { localSupabase } from "./support/local-supabase";
import { authFile, readSeed } from "./support/qa";

// BOQ checker (Workflow B "BOQ intelligence", first increment) as real users against the local stack:
//   E2E_NAMESPACE=boqcheck E2E_PORT=3206 npx playwright test e2e/boq-check.spec.ts --trace off
// The spec creates its own project and proposal (names start with "QA BOQCHK ") and deletes them
// before and after, which removes their BOQ lines, items and costs too. Other specs' exact
// figures in the shared organisation (reports, smoke) are unaffected.

const PREFIX = "QA BOQCHK ";
// Internal costs used only here. The decimals keep them from appearing by chance in an id.
const BELOW_COST = 48750.25; // sold at 45,000
const LOW_MARGIN_COST = 8600.75; // sold at 9,000: a 4.4% margin

let projectId = "";
let proposalId = "";
let boqIds: string[] = [];
let itemIds: string[] = [];

function admin() {
  const env = localSupabase();
  return createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

type Res<T> = { data: T; error: { message: string } | null };
function must<T>(res: Res<T>, what: string): NonNullable<T> {
  if (res.error || res.data == null) throw new Error(`BOQ check fixtures failed (${what}): ${res.error?.message ?? "no data"}`);
  return res.data as NonNullable<T>;
}

async function cleanUp() {
  const db = admin();
  const { organizationId } = readSeed();
  for (const [table, column] of [["proposals", "title"], ["projects", "name"]] as const) {
    const { error } = await db.from(table).delete().eq("organization_id", organizationId).like(column, `${PREFIX}%`);
    if (error) throw new Error(`BOQ check clean-up failed (${table}): ${error.message}`);
  }
}

test.beforeAll(async () => {
  await cleanUp();
  const db = admin();
  const { organizationId, userIds } = readSeed();
  const by = userIds.admin;

  // A project the sales user edits, whose BOQ has a duplicate with two units, a priced line
  // without a quantity, a provisional sum and one clean line.
  const project = must(
    await db.from("projects").insert({
      organization_id: organizationId, name: `${PREFIX}project`, status: "lead", project_type: "other", created_by: by,
    }).select("id").single(),
    "project",
  );
  projectId = project.id as string;
  must(await db.from("project_members").insert({ project_id: projectId, user_id: userIds.sales, role: "editor" }).select("user_id"), "member");
  const boq = [
    { description: `${PREFIX}LED screen 3x2m`, unit: "m2", quantity: 6, unit_price: 850 },
    { description: `${PREFIX}LED screen 3x2m`, unit: "nos", quantity: 1, unit_price: 5100 },
    { description: `${PREFIX}ushers and hostesses`, unit: "شخص", quantity: null, unit_price: 350 },
    { description: `${PREFIX}مبلغ احتياطي لتصاريح البلدية`, unit: "مقطوعية", quantity: 1, unit_price: 15000 },
    { description: `${PREFIX}banquet chairs with covers`, unit: "pcs", quantity: 300, unit_price: 25 },
  ];
  must(
    await db.from("boq_items").insert(boq.map((row, i) => ({ ...row, project_id: projectId, sort_order: i + 1, created_by: by }))).select("id"),
    "boq",
  );
  boqIds = must(await db.from("boq_items").select("id").eq("project_id", projectId).order("sort_order"), "boq ids").map((r) => r.id as string);

  // A proposal: one line sold below cost, one with a thin margin, one without a cost.
  const proposal = must(
    await db.from("proposals").insert({
      organization_id: organizationId, title: `${PREFIX}proposal`, proposal_type: "technical_financial", status: "draft",
      owner_id: by, created_by: by,
    }).select("id").single(),
    "proposal",
  );
  proposalId = proposal.id as string;
  const items = [
    { description: `${PREFIX}LED video wall 5x3m`, quantity: 1, unit: "set", unit_price: 45000 },
    { description: `${PREFIX}sound system with operator`, quantity: 2, unit: "day", unit_price: 9000 },
    { description: `${PREFIX}photography and videography`, quantity: 1, unit: "day", unit_price: 6000 },
  ];
  must(
    await db.from("proposal_items").insert(
      items.map((row, i) => ({ ...row, proposal_id: proposalId, organization_id: organizationId, sort_order: i + 1, created_by: by })),
    ).select("id"),
    "items",
  );
  itemIds = must(await db.from("proposal_items").select("id").eq("proposal_id", proposalId).order("sort_order"), "item ids").map((r) => r.id as string);
  must(
    await db.from("proposal_item_costs").insert([
      { item_id: itemIds[0], organization_id: organizationId, unit_cost: BELOW_COST },
      { item_id: itemIds[1], organization_id: organizationId, unit_cost: LOW_MARGIN_COST },
    ]).select("item_id"),
    "costs",
  );
});

test.afterAll(cleanUp);

async function open(page: Page, path: string) {
  await page.goto(path);
  // The route compiles on its first visit in dev mode; let it settle before interacting.
  await page.waitForLoadState("networkidle");
  const panel = page.getByTestId("boq-check");
  await expect(panel.getByRole("heading", { name: "فحص جدول الكميات" })).toBeVisible();
  return panel;
}

const finding = (panel: Locator, code: string, line?: number) =>
  panel.locator(`[data-code="${code}"]${line ? `[data-line="${line}"]` : ""}`);

async function expectCounts(panel: Locator, counts: { critical: number; warning: number; info: number }) {
  for (const [severity, count] of Object.entries(counts)) {
    await expect(panel.getByTestId(`boq-check-count-${severity}`)).toHaveAttribute("data-count", String(count));
  }
}

const FINANCE_CODES = ["below_cost", "low_margin", "high_margin", "missing_cost"];

test.describe("a sales editor on the project's Pricing tab", () => {
  test.use({ storageState: authFile("sales") });

  test("a. sees the seeded problems, and a finding moves focus to its row", async ({ page }) => {
    const panel = await open(page, `/projects/${projectId}/pricing`);

    // Something is critical, so the panel starts open.
    await expect(panel.getByRole("button", { name: "فحص جدول الكميات" })).toHaveAttribute("aria-expanded", "true");
    await expectCounts(panel, { critical: 1, warning: 4, info: 1 });
    await expect(panel.getByTestId("boq-check-summary")).toHaveText(/حرجة 1، تحذيرات 4، معلومات 1، من 5 بند/);

    // Priced without a quantity: critical, listed first.
    const missing = finding(panel, "missing_quantity", 3);
    await expect(panel.getByTestId("boq-check-findings").locator("li").first()).toHaveAttribute("data-code", "missing_quantity");
    await expect(missing).toHaveAttribute("data-severity", "critical");
    await expect(missing).toContainText("البند 3");
    await expect(missing).toContainText("ushers and hostesses");
    await expect(missing).toContainText("البند مسعّر بلا كمية");

    // The same description twice, in two different units.
    await expect(finding(panel, "duplicate")).toHaveCount(2);
    await expect(finding(panel, "duplicate", 1)).toContainText("الوصف نفسه مكرر في البند 2.");
    await expect(finding(panel, "unit_conflict")).toHaveCount(2);
    await expect(finding(panel, "unit_conflict", 2)).toContainText("«nos» مقابل «m2»");

    await expect(finding(panel, "provisional_sum", 4)).toContainText("مبلغ احتياطي أو تقديري");
    await expect(panel.locator('[data-line="5"]')).toHaveCount(0);
    // The project BOQ has no costs: no finance check ever runs here.
    for (const code of FINANCE_CODES) await expect(finding(panel, code)).toHaveCount(0);

    const categories = panel.getByTestId("boq-check-categories");
    await expect(categories.locator('[data-category="صوت وإضاءة وشاشات"]')).toContainText("2");
    await expect(categories.locator('[data-category="الطواقم"]')).toContainText("1");
    await expect(categories.locator('[data-category="التصاريح"]')).toContainText("1");
    await expect(categories.locator('[data-category="الأثاث"]')).toContainText("1");

    // Clicking a finding moves focus to its row (and scrolls it into view).
    const link = missing.getByRole("link");
    await expect(link).toHaveAttribute("href", `#boq-item-${boqIds[2]}`);
    await link.click();
    const row = page.locator(`#boq-item-${boqIds[2]}`);
    await expect(row).toBeFocused();
    await expect(row).toBeInViewport();
    await expect(row).toContainText("ushers and hostesses");

    // The keyboard does the same.
    const provisional = finding(panel, "provisional_sum", 4).getByRole("link");
    await provisional.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(`#boq-item-${boqIds[3]}`)).toBeFocused();

    // The checker only reports: nothing was changed.
    const { data } = await admin().from("boq_items").select("quantity, unit").eq("id", boqIds[2]).single();
    expect(data).toEqual({ quantity: null, unit: "شخص" });
  });
});

test.describe("finance on the proposal", () => {
  test.use({ storageState: authFile("finance") });

  test("b. sees the line sold below cost, the thin margin and the missing cost", async ({ page }) => {
    const panel = await open(page, `/proposals/${proposalId}`);
    await expect(page.getByLabel("التكلفة").first()).toHaveValue(String(BELOW_COST));

    await expect(panel.getByRole("button", { name: "فحص جدول الكميات" })).toHaveAttribute("aria-expanded", "true");
    await expectCounts(panel, { critical: 1, warning: 1, info: 1 });
    const below = finding(panel, "below_cost", 1);
    await expect(below).toHaveAttribute("data-severity", "critical");
    await expect(below).toContainText("سعر البيع أقل من التكلفة الداخلية");
    await expect(below).toContainText("LED video wall 5x3m");
    await expect(finding(panel, "low_margin", 2)).toContainText("هامش الربح 4.4% فقط");
    await expect(finding(panel, "missing_cost", 3)).toBeVisible();

    await below.getByRole("link").click();
    await expect(page.locator(`#proposal-item-${itemIds[0]}`)).toBeFocused();
  });
});

test.describe("a sales user (no finance access) on the proposal", () => {
  test.use({ storageState: authFile("sales") });

  test("c. gets no cost-based finding and no cost reaches the page", async ({ page }) => {
    const panel = await open(page, `/proposals/${proposalId}`);
    await expect(page.getByRole("columnheader", { name: "التكلفة" })).toHaveCount(0);

    // Without costs these lines are clean: the empty state, and the panel starts closed.
    await expect(panel.getByTestId("boq-check-summary")).toHaveText("لا ملاحظات على جدول الكميات");
    const toggle = panel.getByRole("button", { name: "فحص جدول الكميات" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(panel.getByTestId("boq-check-categories")).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(panel.getByTestId("boq-check-categories").locator('[data-category="صوت وإضاءة وشاشات"]')).toContainText("2");
    await expect(panel.getByTestId("boq-check-categories").locator('[data-category="التصوير والبث"]')).toContainText("1");

    for (const code of FINANCE_CODES) await expect(finding(panel, code)).toHaveCount(0);
    const html = await page.content();
    for (const figure of [String(BELOW_COST), "48,750", String(LOW_MARGIN_COST), "8,600"]) {
      expect(html, `page must not contain "${figure}"`).not.toContain(figure);
    }
    expect(html).not.toContain("التكلفة الداخلية");
  });
});

test.describe("on a 375px phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  const fits = (page: Page) =>
    page.evaluate(() => {
      const panel = document.querySelector('[data-testid="boq-check"]')?.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        panelInside: Boolean(panel && panel.left >= 0 && panel.right <= window.innerWidth),
      };
    });

  test.describe("the Pricing tab", () => {
    test.use({ storageState: authFile("sales") });

    test("d. has no horizontal page scroll with the panel open", async ({ page }) => {
      const panel = await open(page, `/projects/${projectId}/pricing`);
      await expect(finding(panel, "missing_quantity", 3)).toBeVisible();
      expect(await fits(page)).toEqual({ overflow: 0, panelInside: true });
    });
  });

  test.describe("the proposal, as finance", () => {
    test.use({ storageState: authFile("finance") });

    test("d. has no horizontal page scroll with the panel open", async ({ page }) => {
      const panel = await open(page, `/proposals/${proposalId}`);
      await expect(finding(panel, "below_cost", 1)).toBeVisible();
      expect(await fits(page)).toEqual({ overflow: 0, panelInside: true });
    });
  });
});
