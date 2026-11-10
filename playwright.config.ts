import { defineConfig, devices } from "@playwright/test";
import { localSupabase } from "./e2e/support/local-supabase";

// End-to-end tests run only against the LOCAL Supabase stack (the helper refuses any
// other host) and a Next.js server started for the run on port 3100.
const supabase = localSupabase();
const PORT = Number(process.env.E2E_PORT ?? 3100);
const prodServer = Boolean(process.env.CI || process.env.E2E_PROD);

export default defineConfig({
  testDir: "./e2e",
  // One shared seeded database: run in a fixed order.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  globalSetup: "./e2e/global-setup.ts",
  use: {
    // localhost, not 127.0.0.1: the Next.js dev server only serves its scripts to allowed origins.
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    locale: "en-US",
    timezoneId: "Asia/Riyadh",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "smoke", testMatch: /.*\.spec\.ts/, dependencies: ["setup"], use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: prodServer ? `npx next build && npx next start -p ${PORT}` : `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 400_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabase.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabase.publishableKey,
      // Never the real AI service in tests: the deterministic mock provider, with limits high
      // enough that repeated local runs never hit them (limit logic has its own unit tests).
      ANTHROPIC_API_KEY: "",
      AI_PROVIDER: "mock",
      AI_LIMIT_PROPOSAL_DRAFT_PER_HOUR: "500",
      AI_LIMIT_PROPOSAL_DRAFT_PER_DAY: "2000",
      AI_LIMIT_TENDER_ANALYSIS_PER_HOUR: "500",
      AI_LIMIT_TENDER_ANALYSIS_PER_DAY: "2000",
      AI_LIMIT_OPS_EXTRACT_PER_HOUR: "500",
      AI_LIMIT_OPS_EXTRACT_PER_DAY: "2000",
      AI_LIMIT_MANAGEMENT_BRIEF_PER_HOUR: "500",
      AI_LIMIT_MANAGEMENT_BRIEF_PER_DAY: "2000",
    },
  },
});
