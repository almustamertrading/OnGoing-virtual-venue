import type { Page } from "@playwright/test";
import { QA } from "./qa";

export async function login(page: Page, email: string, password: string = QA.password) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/projects/);
}
