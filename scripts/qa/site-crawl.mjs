// Website crawl: visits every route as each QA role (local stack only), desktop and phone, and records crashes,
// console errors, failed requests, Next.js error/404 screens, horizontal overflow, unnamed controls, timings
// and axe (WCAG 2.1 A/AA) violations. Read-only: GET navigations, no form submissions or clicks.
//
//   1. npx playwright test            (seeds the QA users and writes e2e/.auth/qa/*.json)
//   2. npx next start -p 3300         (with the local stack's NEXT_PUBLIC_SUPABASE_* variables)
//   3. npm i --no-save axe-core@4.10.3
//   4. node scripts/qa/site-crawl.mjs e2e/.auth/qa <outDir> node_modules/axe-core/axe.min.js ['{"reportId":…,"venueId":…,"layoutId":…}']
//   5. node scripts/qa/site-crawl-report.mjs <outDir>/results.json <projectId> <proposalId>
// Stop the server by its port afterwards (`fuser -k 3300/tcp`): Next.js renames its process to "next-server",
// so killing by command line misses it, and a stale server keeps serving an older build after a rebuild.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.CRAWL_BASE || "http://localhost:3300";
const [AUTH, OUT, AXE, FIXJSON] = process.argv.slice(2);
const FIX = JSON.parse(FIXJSON || "{}");
const seed = JSON.parse(fs.readFileSync(path.join(AUTH, "seed.json"), "utf8"));
const P = seed.projectId;
const PR = seed.proposalId;
fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });

const PUBLIC = ["/", "/work", "/contact", "/login", "/login/reset"];
const PLATFORM = ["/projects", "/summary", "/proposals", "/proposals/templates", "/calendar", "/documents", "/reports",
  "/settings", "/settings/account", "/settings/organization", "/settings/members", "/settings/domains", "/settings/audit"];
const TABS = ["", "/scope", "/plan", "/structure", "/tasks", "/pricing", "/procurement", "/finance", "/inventory", "/evaluation",
  "/team", "/venues", "/layouts", "/documents", "/requirements", "/operations", "/activity"];
const PROJECT = TABS.map((t) => `/projects/${P}${t}`);
const EXTRA = [`/proposals/${PR}`, `/proposals/${PR}/print`];
if (FIX.reportId) EXTRA.push(`/projects/${P}/operations/${FIX.reportId}`);
if (FIX.venueId) EXTRA.push(`/projects/${P}/venues/${FIX.venueId}`);
if (FIX.layoutId) EXTRA.push(`/projects/${P}/layouts/${FIX.layoutId}`);
const ALL = [...PUBLIC, ...PLATFORM, ...PROJECT, ...EXTRA];
const MOBILE = ["/", "/work", "/contact", "/login", "/projects", "/summary", `/projects/${P}`, `/projects/${P}/tasks`, `/projects/${P}/pricing`,
  `/projects/${P}/operations`, `/projects/${P}/requirements`, `/projects/${P}/procurement`, `/projects/${P}/finance`, "/proposals",
  `/proposals/${PR}`, "/reports", "/calendar", "/documents", "/settings/account", "/settings/members"];
const ROLES = (process.env.CRAWL_ROLES || "anon,admin,finance,sales,pm,ops,viewer,outsider").split(",");
const AXE_ROLES = new Set(["anon", "admin", "viewer"]);
// Map tiles and other third-party hosts are blocked by the sandbox network: counted, not reported as app errors.
const EXTERNAL = (u) => !u.startsWith(BASE);
const slug = (u) => (u.replace(P, "P").replace(PR, "PR").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root").slice(0, 80);

async function visit(context, role, url, opts) {
  const page = await context.newPage();
  if (opts.mobile) await page.setViewportSize({ width: 375, height: 812 });
  const rec = { role, url, viewport: opts.mobile ? 375 : 1280, console: [], pageErrors: [], failed: [], externalBlocked: 0 };
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const loc = m.location()?.url || "";
    if (loc && EXTERNAL(loc)) { rec.externalBlocked++; return; }
    const t = m.text();
    if (/Failed to fetch \(0\): https?:\/\/(?!localhost)/.test(t) || /AJAXError/.test(t)) { rec.externalBlocked++; return; }
    rec.console.push(t.slice(0, 300));
  });
  page.on("pageerror", (e) => rec.pageErrors.push(String(e.message || e).slice(0, 300)));
  page.on("response", (r) => {
    const u = r.url();
    if (!EXTERNAL(u) && r.status() >= 400) rec.failed.push(`${r.status()} ${r.request().method()} ${u.replace(BASE, "")}`);
  });
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (EXTERNAL(u)) { rec.externalBlocked++; return; }
    const f = r.failure()?.errorText || "";
    if (/ERR_ABORTED/.test(f)) return; // navigation away / prefetch cancelled
    rec.failed.push(`FAILED ${r.method()} ${u.replace(BASE, "")} ${f}`);
  });
  const t0 = Date.now();
  let resp = null;
  try {
    resp = await page.goto(BASE + url, { waitUntil: "load", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  } catch (e) {
    rec.navError = String(e.message).split("\n")[0].slice(0, 200);
  }
  rec.ms = Date.now() - t0;
  rec.status = resp ? resp.status() : null;
  rec.finalUrl = page.url().replace(BASE, "");
  Object.assign(rec, await page.evaluate(() => {
    const body = document.body ? document.body.innerText : "";
    const named = (el) => (el.innerText || "").trim() || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")
      || el.getAttribute("title") || el.querySelector("img[alt]:not([alt=''])");
    const unnamed = [...document.querySelectorAll("button, a[href], [role=button]")].filter((el) => !named(el));
    const nav = performance.getEntriesByType("navigation")[0];
    return {
      title: document.title,
      h1: [...document.querySelectorAll("h1")].map((h) => h.innerText.trim()).slice(0, 3),
      lang: document.documentElement.lang,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      nextError: /Application error|Internal Server Error|client-side exception|server-side exception/.test(body),
      // The app's own not-found page, or the framework default if it were ever shown.
      notFound: !!document.querySelector("[data-testid='not-found']") || /This page could not be found/.test(body),
      imgNoAlt: document.querySelectorAll("img:not([alt])").length,
      unnamedCount: unnamed.length,
      unnamed: unnamed.slice(0, 4).map((el) => el.outerHTML.slice(0, 160)),
      links: [...new Set([...document.querySelectorAll("a[href^='/']")].map((a) => a.getAttribute("href").split("#")[0].split("?")[0]))],
      ttfb: nav ? Math.round(nav.responseStart) : null,
      dcl: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
    };
  }).catch((e) => ({ evalError: String(e.message).slice(0, 200) })));
  if (opts.axe && !rec.navError) {
    await page.addScriptTag({ path: AXE }).catch(() => {});
    rec.axe = await page.evaluate(async () => {
      const r = await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"],
      });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
        targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")), html: v.nodes.slice(0, 2).map((n) => n.html.slice(0, 140)) }));
    }).catch((e) => [{ id: "axe-error", help: String(e.message).slice(0, 200), nodes: 0 }]);
  }
  const problem = rec.pageErrors.length || rec.console.length || rec.failed.length || rec.nextError || rec.navError || (opts.mobile && rec.overflow > 2);
  if (opts.shot || problem) {
    await page.screenshot({ path: path.join(OUT, "shots", `${role}-${opts.mobile ? "m" : "d"}-${slug(url)}.png`), fullPage: !!opts.mobile }).catch(() => {});
  }
  await page.close();
  return rec;
}

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const role of ROLES) {
    const storageState = role === "anon" ? undefined : path.join(AUTH, `${role}.json`);
    const context = await browser.newContext({ storageState, viewport: { width: 1280, height: 800 }, locale: "ar-SA" });
    const visited = new Set();
    const links = new Set();
    const pages = role === "anon" ? ALL : ALL.filter((u) => !PUBLIC.includes(u) || u === "/");
    for (const url of pages) {
      const rec = await visit(context, role, url, { axe: AXE_ROLES.has(role), shot: role === "admin" });
      results.push(rec);
      visited.add(url);
      (rec.links || []).forEach((l) => links.add(l));
      process.stdout.write(`${role} ${rec.status} ${url.replace(P, "P").replace(PR, "PR")} ${rec.ms}ms\n`);
    }
    if (role === "admin" || role === "viewer" || role === "anon") {
      for (const url of MOBILE) {
        const rec = await visit(context, role, url, { mobile: true, shot: role === "admin" });
        results.push(rec);
      }
    }
    // Internal links found on the pages, not yet visited (one level deep).
    const extra = [...links].filter((l) => !visited.has(l) && !l.startsWith("/auth/")).slice(0, 80);
    for (const url of extra) {
      const rec = await visit(context, role, url, { linkCheck: true });
      rec.fromLinks = true;
      results.push(rec);
      process.stdout.write(`${role} link ${rec.status} ${url.replace(P, "P").replace(PR, "PR")}\n`);
    }
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
  console.log(`done: ${results.length} page visits`);
})();
