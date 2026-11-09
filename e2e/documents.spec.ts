import { createClient } from "@supabase/supabase-js";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { localSupabase } from "./support/local-supabase";
import { QA, authFile, readSeed } from "./support/qa";

// Central document management (Workstream C), acting as real users through the UI:
// - uploads go from the browser straight to the private `documents` bucket, then a server action
//   registers the row;
// - downloads use one-minute signed links;
// - versions chain through supersedes_id;
// - RLS decides who sees which document (confidential ones need finance access).
// The steps build on each other, so they run in order and stop at the first failure.
test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);
const pdf = (label: string) =>
  Buffer.from(`%PDF-1.4\n% ${label}\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n`);

type TestFile = { name: string; body: Buffer };
const CONTRACT = { title: `QA venue contract ${run}`, name: "QA venue contract.pdf", body: pdf(`contract ${run}`) };
const CONTRACT_V2 = { name: "QA venue contract v2.pdf", body: pdf(`contract v2 ${run}`) };
const CONFIDENTIAL = { title: `QA priced contract ${run}`, name: "عقد مسعّر.pdf", body: pdf(`priced ${run}`) };
const DISPOSABLE = { title: `QA disposable ${run}`, name: "QA disposable.pdf", body: pdf(`disposable ${run}`) };

function admin() {
  const env = localSupabase();
  return createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Opens a page and waits until it is interactive (the first dev-mode compile is slow). */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

const library = (page: Page) => page.getByRole("region", { name: "قائمة المستندات" });
const rowFor = (page: Page, title: string) => page.getByTestId("document-row").filter({ hasText: title });

async function upload(page: Page, file: TestFile, options: { title?: string; category?: string; confidential?: boolean } = {}) {
  await page.getByRole("button", { name: "رفع مستند" }).click();
  const dialog = page.getByRole("dialog", { name: "رفع مستند" });
  await dialog.getByLabel("الملف", { exact: true }).setInputFiles({ name: file.name, mimeType: "application/pdf", buffer: file.body });
  // The title defaults to the file name.
  await expect(dialog.getByLabel("العنوان", { exact: true })).toHaveValue(file.name);
  if (options.title) await dialog.getByLabel("العنوان", { exact: true }).fill(options.title);
  if (options.category) await dialog.getByLabel("التصنيف").selectOption(options.category);
  if (options.confidential) await dialog.getByLabel("مستند سرّي").check();
  await dialog.getByRole("button", { name: "رفع", exact: true }).click();
  await expect(dialog).toBeHidden();
}

/** Clicks a download button and returns the signed URL the browser was sent to. */
async function downloadUrl(page: Page, button: Locator) {
  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
  return download.url();
}

test.describe("as a sales editor on the project", () => {
  test.use({ storageState: authFile("sales") });

  test("a. uploads a PDF in the project tab; it appears there and in /documents", async ({ page }) => {
    await open(page, `/projects/${readSeed().projectId}/documents`);
    await upload(page, CONTRACT, { title: CONTRACT.title, category: "contract" });
    await expect(library(page).getByRole("status")).toContainText(CONTRACT.title);

    const row = rowFor(page, CONTRACT.title);
    await expect(row).toBeVisible();
    await expect(row).toContainText(CONTRACT.name);
    await expect(row).toContainText("v1");
    await expect(row).toContainText("عقد");
    await expect(row).toContainText(QA.users.sales);
    await expect(row).toContainText(/\d+ B/);

    await open(page, "/documents");
    const libraryRow = rowFor(page, CONTRACT.title);
    await expect(libraryRow).toBeVisible();
    await expect(libraryRow).toContainText(QA.project);
  });

  test("b. its signed download URL returns 200 with the same bytes", async ({ page, request }) => {
    await open(page, `/projects/${readSeed().projectId}/documents`);
    const url = await downloadUrl(page, rowFor(page, CONTRACT.title).getByRole("button", { name: /^تنزيل/ }));
    expect(url).toContain("/storage/v1/object/sign/documents/");
    const res = await request.get(url);
    expect(res.status()).toBe(200);
    expect(Buffer.compare(await res.body(), CONTRACT.body)).toBe(0);
    expect(res.headers()["content-disposition"]).toContain("attachment");
  });

  test("c. a new version shows as version 2 and the history lists version 1", async ({ page, request }) => {
    const { projectId } = readSeed();
    await open(page, `/projects/${projectId}/documents`);
    await rowFor(page, CONTRACT.title).getByRole("button", { name: /^رفع إصدار جديد/ }).click();
    const dialog = page.getByRole("dialog", { name: "رفع إصدار جديد" });
    await dialog.getByLabel("الملف", { exact: true }).setInputFiles({ name: CONTRACT_V2.name, mimeType: "application/pdf", buffer: CONTRACT_V2.body });
    // A new version keeps the document's title.
    await expect(dialog.getByLabel("العنوان", { exact: true })).toHaveValue(CONTRACT.title);
    await dialog.getByRole("button", { name: "رفع", exact: true }).click();
    await expect(dialog).toBeHidden();

    // Only the latest version is listed.
    const row = rowFor(page, CONTRACT.title);
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("v2");
    await expect(row).toContainText(CONTRACT_V2.name);

    await row.getByRole("button", { name: /^سجل إصدارات/ }).click();
    const history = page.getByRole("dialog", { name: "سجل الإصدارات" });
    const entries = history.getByTestId("version-entry");
    await expect(entries).toHaveCount(2);
    await expect(entries.nth(0)).toContainText("الإصدار 2");
    await expect(entries.nth(1)).toContainText("الإصدار 1");
    await expect(entries.nth(1)).toContainText(CONTRACT.name);
    // The previous version stays downloadable.
    const v1 = await downloadUrl(page, entries.nth(1).getByRole("button", { name: "تنزيل الإصدار 1" }));
    expect(Buffer.compare(await (await request.get(v1)).body(), CONTRACT.body)).toBe(0);
    await history.getByRole("button", { name: "إغلاق" }).click();
    await expect(history).toBeHidden();

    // "Show previous versions" lists both rows.
    await open(page, `/projects/${projectId}/documents?versions=all`);
    await expect(rowFor(page, CONTRACT.title)).toHaveCount(2);
    await expect(rowFor(page, CONTRACT.title).filter({ hasText: "إصدار سابق" })).toContainText("v1");
  });
});

test.describe("as a project viewer", () => {
  test.use({ storageState: authFile("viewer") });

  test("d. sees the document but no upload button", async ({ page }) => {
    await open(page, `/projects/${readSeed().projectId}/documents`);
    const row = rowFor(page, CONTRACT.title);
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: /^تنزيل/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "رفع مستند" })).toHaveCount(0);
    await expect(row.getByRole("button", { name: /^(حذف|تعديل|رفع إصدار جديد)/ })).toHaveCount(0);

    // Viewers hold no working capability, so they cannot add organisation documents either.
    await open(page, "/documents");
    await expect(rowFor(page, CONTRACT.title)).toBeVisible();
    await expect(page.getByRole("button", { name: "رفع مستند" })).toHaveCount(0);
  });
});

test.describe("confidential documents", () => {
  test("e. finance uploads a confidential document; sales cannot see it, finance can", async ({ browser, request }) => {
    const financeContext = await browser.newContext({ storageState: authFile("finance") });
    const finance = await financeContext.newPage();
    await open(finance, "/documents");
    await upload(finance, CONFIDENTIAL, { title: CONFIDENTIAL.title, category: "contract", confidential: true });
    const row = rowFor(finance, CONFIDENTIAL.title);
    await expect(row).toBeVisible();
    await expect(row).toContainText("سرّي");
    await expect(row).toContainText("المنظمة");
    await expect(row).toContainText(CONFIDENTIAL.name);
    // Finance can download it, under its original (Arabic) file name.
    const url = await downloadUrl(finance, row.getByRole("button", { name: /^تنزيل/ }));
    const res = await request.get(url);
    expect(res.status()).toBe(200);
    expect(Buffer.compare(await res.body(), CONFIDENTIAL.body)).toBe(0);
    expect(res.headers()["content-disposition"]).toContain(`filename*=UTF-8''${encodeURIComponent(CONFIDENTIAL.name)}`);
    await financeContext.close();

    const salesContext = await browser.newContext({ storageState: authFile("sales") });
    const sales = await salesContext.newPage();
    await open(sales, "/documents");
    await expect(rowFor(sales, CONTRACT.title)).toBeVisible();
    await expect(rowFor(sales, CONFIDENTIAL.title)).toHaveCount(0);
    // Not even in the page payload.
    expect(await sales.content()).not.toContain(CONFIDENTIAL.title);
    await open(sales, "/documents?q=priced&versions=all");
    await expect(library(sales).getByText("لا توجد مستندات مطابقة")).toBeVisible();
    // Sales may add organisation documents, but cannot mark them confidential.
    await sales.getByRole("button", { name: "رفع مستند" }).click();
    const dialog = sales.getByRole("dialog", { name: "رفع مستند" });
    await expect(dialog.getByLabel("الملف", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("مستند سرّي")).toHaveCount(0);
    await salesContext.close();
  });
});

test.describe("deleting", () => {
  test.use({ storageState: authFile("sales") });

  test("f. deleting removes the row and the object; the old signed URL stops working", async ({ page, request }) => {
    await open(page, `/projects/${readSeed().projectId}/documents`);
    await upload(page, DISPOSABLE, { title: DISPOSABLE.title });
    const row = rowFor(page, DISPOSABLE.title);
    await expect(row).toBeVisible();
    const { data: stored } = await admin().from("documents").select("storage_path").eq("title", DISPOSABLE.title).single();
    expect(stored?.storage_path).toMatch(new RegExp(`^${readSeed().organizationId}/${readSeed().projectId}/[0-9a-f-]{36}/QA-disposable\\.pdf$`));
    const url = await downloadUrl(page, row.getByRole("button", { name: /^تنزيل/ }));
    expect((await request.get(url)).status()).toBe(200);

    page.once("dialog", (confirmDelete) => confirmDelete.accept());
    await row.getByRole("button", { name: /^حذف/ }).click();
    await expect(library(page).getByRole("status")).toContainText("تم حذف");
    await expect(row).toHaveCount(0);

    // The file is gone, not just hidden: a link signed before the delete no longer serves it…
    expect((await request.get(url)).status()).not.toBe(200);
    // …and neither the row nor the object remains.
    const db = admin();
    expect((await db.from("documents").select("id").eq("title", DISPOSABLE.title)).data).toHaveLength(0);
    const folder = stored!.storage_path.split("/").slice(0, 3).join("/");
    expect((await db.storage.from("documents").list(folder)).data ?? []).toHaveLength(0);
  });
});

test.describe("isolation and layout", () => {
  test("someone outside the organisation sees none of its documents", async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile("outsider") });
    const page = await context.newPage();
    await open(page, "/documents");
    await expect(library(page).getByText("لا توجد مستندات بعد.")).toBeVisible();
    await expect(page.getByRole("button", { name: "رفع مستند" })).toHaveCount(0);
    expect(await page.content()).not.toContain(CONTRACT.title);
    await context.close();
  });

  test("the library works at 375 px without horizontal page scroll", async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile("sales"), viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    for (const path of ["/documents", `/projects/${readSeed().projectId}/documents`]) {
      await open(page, path);
      await expect(rowFor(page, CONTRACT.title)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
    }
    await page.getByRole("button", { name: "رفع مستند" }).click();
    const box = await page.getByRole("dialog", { name: "رفع مستند" }).boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 375).toBe(true);
    await context.close();
  });
});

// Document rows go with the QA organisation on the next seed, but storage objects do not:
// remove everything this run uploaded (local stack only).
test.afterAll(async () => {
  const db = admin();
  const { organizationId } = readSeed();
  const list = async (prefix: string): Promise<string[]> => {
    const { data } = await db.storage.from("documents").list(prefix, { limit: 1000 });
    const nested = await Promise.all(
      (data ?? []).map((entry) => (entry.id ? Promise.resolve([`${prefix}/${entry.name}`]) : list(`${prefix}/${entry.name}`))),
    );
    return nested.flat();
  };
  const paths = await list(organizationId);
  if (paths.length) await db.storage.from("documents").remove(paths);
  await db.from("documents").delete().eq("organization_id", organizationId);
});
