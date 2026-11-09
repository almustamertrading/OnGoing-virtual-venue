import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { localSupabase } from "./support/local-supabase";
import { authFile, readSeed } from "./support/qa";

// Global calendar (Workstream B). Runs against the local stack in its own namespace:
//   E2E_NAMESPACE=calendar E2E_PORT=3202 npx playwright test e2e/calendar.spec.ts
// Tests work in March 2027 so they never depend on today's date (except the "today" link).

const MONTH = "/calendar?date=2027-03-01";
const unique = (label: string) => `${label} ${Date.now().toString(36)}`;
const named = (title: string) => new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

/** Service-role client for extra test data in this namespace's organisation (local only). */
function admin() {
  const env = localSupabase();
  return createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function open(page: Page, url: string) {
  await page.goto(url);
  // The first visit compiles the route in dev mode; interact only once it is hydrated.
  await page.waitForLoadState("networkidle");
}

/** The heading naming the visible period ("مارس 2027"); day headings in lists also contain it. */
const period = (page: Page, name: string) => page.getByRole("heading", { level: 2, name, exact: true });

async function expectNoText(page: Page, text: string) {
  expect(await page.content(), `page must not contain "${text}"`).not.toContain(text);
}

/** Opens the create dialog and fills the common fields. */
async function startEvent(page: Page, title: string, from: string, to: string) {
  await page.getByRole("button", { name: "حدث جديد" }).click();
  const dialog = page.getByRole("dialog", { name: "حدث جديد" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("العنوان").fill(title);
  await dialog.getByLabel("البداية").fill(from);
  await dialog.getByLabel("النهاية").fill(to);
  return dialog;
}

test.describe("as operations", () => {
  test.use({ storageState: authFile("ops") });

  test("a. ops creates an organisation-wide meeting and sees it in the month and agenda views", async ({ page }) => {
    const title = unique("QA all-hands");
    await open(page, MONTH);
    await expect(period(page, "مارس 2027")).toBeVisible();

    const dialog = await startEvent(page, title, "2027-03-10T10:00", "2027-03-10T11:00");
    // Operations may add organisation-wide events, so that is the default scope.
    await expect(dialog.getByLabel("المشروع")).toHaveValue("");
    await expect(dialog.getByLabel("النوع")).toHaveValue("meeting");
    await dialog.getByLabel("الموقع (اختياري)").fill("QA head office");
    await dialog.getByRole("button", { name: "حفظ الحدث" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("calendar-notice")).toContainText(`تم حفظ الحدث «${title}»`);

    const month = page.getByTestId("month-grid");
    await expect(month.getByRole("button", { name: named(title) })).toBeVisible();
    await expect(month.getByRole("button", { name: named(title) })).toContainText("10:00");

    await page.getByRole("navigation", { name: "طريقة العرض" }).getByRole("link", { name: "قائمة" }).click();
    await expect(page).toHaveURL(/view=agenda/);
    const day = page
      .getByTestId("agenda-list")
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: /الأربعاء، 10 مارس 2027/ }) });
    const item = day.getByRole("button", { name: named(title) });
    await expect(item).toBeVisible();
    await expect(item).toContainText("10:00–11:00");
    await expect(item).toContainText("QA head office");

    // The event opens in the edit dialog with its saved values, and can be changed.
    await item.click();
    const edit = page.getByRole("dialog", { name: "تعديل الحدث" });
    await expect(edit.getByLabel("العنوان")).toHaveValue(title);
    await expect(edit.getByLabel("البداية")).toHaveValue("2027-03-10T10:00");
    await expect(edit.getByLabel("الموقع (اختياري)")).toHaveValue("QA head office");
    await edit.getByLabel("النهاية").fill("2027-03-10T11:30");
    await edit.getByRole("button", { name: "حفظ الحدث" }).click();
    await expect(edit).toBeHidden();
    await expect(day.getByRole("button", { name: named(title) })).toContainText("10:00–11:30");
  });
});

test.describe("as a sales editor on the project", () => {
  test.use({ storageState: authFile("sales") });

  test("b. sales creates a project site visit and is warned about an overlapping event", async ({ page }) => {
    const { projectId } = readSeed();
    const visit = unique("QA site visit");
    const tasting = unique("QA catering tasting");
    await open(page, MONTH);

    let dialog = await startEvent(page, visit, "2027-03-17T10:00", "2027-03-17T12:00");
    await dialog.getByLabel("النوع").selectOption("site_visit");
    await dialog.getByLabel("المشروع").selectOption(projectId);
    await expect(dialog.getByTestId("overlap-warning")).toHaveCount(0);
    await dialog.getByRole("button", { name: "حفظ الحدث" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("month-grid").getByRole("button", { name: named(visit) })).toBeVisible();

    dialog = await startEvent(page, tasting, "2027-03-17T11:00", "2027-03-17T13:00");
    await dialog.getByLabel("المشروع").selectOption(projectId);
    const warning = dialog.getByTestId("overlap-warning");
    await expect(warning).toBeVisible();
    await expect(warning).toContainText("يتداخل");
    await expect(warning).toContainText(visit);

    // Moving it after the visit clears the warning; moving it back brings it back.
    await dialog.getByLabel("البداية").fill("2027-03-17T12:00");
    await expect(warning).toHaveCount(0);
    await dialog.getByLabel("البداية").fill("2027-03-17T11:00");
    await expect(dialog.getByTestId("overlap-warning")).toBeVisible();

    // A scheduling aid, not a block: the event saves and the confirmation repeats the overlap.
    await dialog.getByRole("button", { name: "حفظ الحدث" }).click();
    await expect(dialog).toBeHidden();
    const notice = page.getByTestId("calendar-notice");
    await expect(notice).toContainText(`تم حفظ الحدث «${tasting}»`);
    await expect(notice).toContainText(visit);
    const chip = page.getByTestId("month-grid").getByRole("button", { name: named(tasting) });
    await expect(chip).toBeVisible();

    // The editor can delete it again.
    await chip.click();
    const edit = page.getByRole("dialog", { name: "تعديل الحدث" });
    page.once("dialog", (d) => d.accept());
    await edit.getByRole("button", { name: "حذف", exact: true }).click();
    await expect(edit).toBeHidden();
    await expect(notice).toContainText(`تم حذف الحدث «${tasting}»`);
    await expect(chip).toHaveCount(0);
  });
});

test.describe("as a viewer", () => {
  test.use({ storageState: authFile("viewer") });

  test("c. a viewer has no create button and sees events read-only", async ({ page }) => {
    const { organizationId, userIds } = readSeed();
    const title = unique("QA board review");
    const { error } = await admin().from("calendar_events").insert({
      organization_id: organizationId, title, kind: "meeting", created_by: userIds.admin,
      starts_at: "2027-03-12T06:00:00Z", ends_at: "2027-03-12T07:00:00Z",
    });
    expect(error).toBeNull();

    await open(page, MONTH);
    await expect(page.getByRole("heading", { name: "التقويم", exact: true })).toBeVisible();
    await expect(page.getByTestId("month-grid")).toBeVisible();
    await expect(page.getByRole("button", { name: "حدث جديد" })).toHaveCount(0);

    // 06:00 UTC is 09:00 in Riyadh, the organisation's time zone.
    const event = page.getByTestId("month-grid").getByRole("button", { name: named(title) });
    await expect(event).toContainText("09:00");
    await event.click();
    const details = page.getByRole("dialog", { name: "تفاصيل الحدث" });
    await expect(details).toContainText(title);
    await expect(details.getByRole("button", { name: "حفظ الحدث" })).toHaveCount(0);
    await details.getByRole("button", { name: "إغلاق" }).click();

    await page.getByTestId("month-grid").getByRole("button", { name: /^الجمعة، 12 مارس 2027/ }).click();
    const day = page.getByRole("dialog", { name: /12 مارس 2027/ });
    await expect(day.getByRole("button", { name: named(title) })).toBeVisible();
    await expect(day.getByRole("button", { name: "إضافة حدث في هذا اليوم" })).toHaveCount(0);
  });
});

test.describe("finance confidentiality", () => {
  test("d. finance sees an invoice due date in the feed that sales does not", async ({ browser }) => {
    const { projectId } = readSeed();
    const { error } = await admin()
      .from("invoices").update({ due_date: "2027-03-25" }).eq("project_id", projectId).eq("number", "QA-INV-1");
    expect(error).toBeNull();

    const finance = await browser.newContext({ storageState: authFile("finance") });
    const fp = await finance.newPage();
    await open(fp, `${MONTH}&view=agenda`);
    const invoice = fp.getByTestId("agenda-list").getByRole("link", { name: /QA deposit invoice/ });
    await expect(invoice).toBeVisible();
    await expect(invoice).toContainText("استحقاق فاتورة");
    await expect(invoice).toHaveAttribute("href", `/projects/${projectId}/finance`);
    await fp.goto(MONTH);
    await expect(fp.getByTestId("month-grid").getByRole("link", { name: /QA deposit invoice/ })).toBeVisible();
    await finance.close();

    const sales = await browser.newContext({ storageState: authFile("sales") });
    const sp = await sales.newPage();
    await open(sp, `${MONTH}&view=agenda`);
    await expect(period(sp, "مارس 2027")).toBeVisible();
    await expect(sp.getByTestId("agenda-list")).toBeVisible();
    await expect(sp.getByRole("checkbox", { name: "الفواتير" })).toHaveCount(0);
    await expectNoText(sp, "QA deposit invoice");
    await expectNoText(sp, "QA-INV-1");
    await sales.close();
  });
});

test.describe("navigation", () => {
  test.use({ storageState: authFile("pm") });

  test("e. previous, next and today change the visible month", async ({ page }) => {
    const title = (name: string) => period(page, name);
    await open(page, "/calendar?date=2027-03-15");
    await expect(title("مارس 2027")).toBeVisible();
    const grid = page.getByTestId("month-grid");
    await expect(grid.getByRole("button", { name: /^الاثنين، 1 مارس 2027/ })).toBeVisible();

    await page.getByRole("link", { name: "الشهر التالي" }).click();
    await expect(page).toHaveURL(/date=2027-04-15/);
    await expect(title("أبريل 2027")).toBeVisible();
    await expect(grid.getByRole("button", { name: /^الخميس، 1 أبريل 2027/ })).toBeVisible();

    await page.getByRole("link", { name: "الشهر السابق" }).click();
    await expect(title("مارس 2027")).toBeVisible();
    await page.getByRole("link", { name: "الشهر السابق" }).click();
    await expect(page).toHaveURL(/date=2027-02-15/);
    await expect(title("فبراير 2027")).toBeVisible();

    // Today: this month in the organisation's time zone, with today highlighted.
    const parts = new Intl.DateTimeFormat("ar-u-ca-gregory-nu-latn", { month: "long", year: "numeric", timeZone: "Asia/Riyadh" })
      .formatToParts(new Date());
    const thisMonth = `${parts.find((p) => p.type === "month")?.value} ${parts.find((p) => p.type === "year")?.value}`;
    await page.getByRole("link", { name: "اليوم", exact: true }).click();
    await expect(page).toHaveURL(/\/calendar$/);
    await expect(title(thisMonth)).toBeVisible();
    await expect(grid.locator('[aria-current="date"]')).toHaveCount(1);

    // The week view moves by weeks.
    await open(page, "/calendar?view=week&date=2027-03-10");
    await expect(title("7–13 مارس 2027")).toBeVisible();
    await page.getByRole("link", { name: "الأسبوع التالي" }).click();
    await expect(title("14–20 مارس 2027")).toBeVisible();
  });
});

test.describe("on a phone", () => {
  test.use({ storageState: authFile("ops"), viewport: { width: 375, height: 812 } });

  test("f. at 375 px the month becomes a list and nothing scrolls sideways", async ({ page }) => {
    const noSideScroll = async () =>
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

    await open(page, MONTH);
    await expect(page.getByTestId("month-grid")).toBeHidden();
    await expect(page.getByTestId("month-agenda")).toBeVisible();
    await noSideScroll();

    await open(page, "/calendar?view=week&date=2027-03-10");
    await expect(page.getByTestId("week-grid")).toBeVisible();
    await noSideScroll();

    await page.getByRole("button", { name: "حدث جديد" }).click();
    await expect(page.getByRole("dialog", { name: "حدث جديد" })).toBeVisible();
    await noSideScroll();
  });
});

test.describe("filters", () => {
  test.use({ storageState: authFile("admin") });

  test("g. project and source filters change what is shown and stay in the URL", async ({ page }) => {
    const { organizationId, projectId, userIds } = readSeed();
    const db = admin();
    const townHall = unique("QA town hall");
    const permits = unique("QA permits approved");
    expect((await db.from("calendar_events").insert({
      organization_id: organizationId, title: townHall, kind: "meeting", created_by: userIds.admin,
      starts_at: "2027-03-23T06:00:00Z", ends_at: "2027-03-23T07:00:00Z",
    })).error).toBeNull();
    expect((await db.from("milestones").insert({
      project_id: projectId, title: permits, due_date: "2027-03-23", created_by: userIds.admin,
    })).error).toBeNull();

    await open(page, `${MONTH}&view=agenda`);
    const list = page.getByTestId("agenda-list");
    const event = list.getByRole("button", { name: named(townHall) });
    const milestone = list.getByRole("link", { name: named(permits) });
    await expect(event).toBeVisible();
    await expect(milestone).toHaveAttribute("href", `/projects/${projectId}/tasks`);

    const project = page.getByLabel("المشروع", { exact: true });
    await project.selectOption(projectId);
    await expect(page).toHaveURL(new RegExp(`project=${projectId}`));
    await expect(event).toHaveCount(0);
    await expect(milestone).toBeVisible();

    await project.selectOption("org");
    await expect(page).toHaveURL(/project=org/);
    await expect(event).toBeVisible();
    await expect(milestone).toHaveCount(0);

    await project.selectOption("");
    await page.getByRole("checkbox", { name: "الأحداث", exact: true }).uncheck();
    await expect(page).toHaveURL(/types=project,submission,milestone,task,phase,proposal,rfq,invoice$/);
    await expect(event).toHaveCount(0);
    await expect(milestone).toBeVisible();

    // The URL carries the filters: a reload and the next month keep them.
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("checkbox", { name: "الأحداث", exact: true })).not.toBeChecked();
    await expect(event).toHaveCount(0);
    await expect(milestone).toBeVisible();
    await page.getByRole("link", { name: "الشهر التالي" }).click();
    await expect(page).toHaveURL(/date=2027-04-01&types=project,/);
  });
});
