// Summarises site-crawl results: what is broken, where, and for whom.
// Usage: node scripts/qa/site-crawl-report.mjs <results.json> <projectId> <proposalId>
import fs from "node:fs";
const [file, P, PR] = process.argv.slice(2);
const results = JSON.parse(fs.readFileSync(file, "utf8"));
const short = (u) => (u || "").replaceAll(P, "P").replaceAll(PR, "PR");
const group = (items, key) => items.reduce((m, x) => { const k = key(x); (m[k] ||= []).push(x); return m; }, {});
const out = [];
const line = (s = "") => out.push(s);

const PLATFORM_PREFIXES = ["/projects", "/summary", "/proposals", "/calendar", "/documents", "/reports", "/settings"];
const isPlatform = (u) => PLATFORM_PREFIXES.some((p) => u === p || u.startsWith(p + "/"));
const isScoped = (u) => u.startsWith("/projects/") || u.startsWith("/proposals/");

line(`Visits: ${results.length} (${Object.entries(group(results, (r) => r.role)).map(([k, v]) => `${k} ${v.length}`).join(", ")})`);
line(`External requests blocked by the sandbox (map tiles etc.): ${results.reduce((n, r) => n + r.externalBlocked, 0)}`);

const crashes = results.filter((r) => r.pageErrors.length || r.nextError || r.navError || (r.status && r.status >= 500));
line(`\n## Crashes, server errors, navigation failures: ${crashes.length}`);
for (const r of crashes) line(`- [${r.role} ${r.viewport}] ${short(r.url)} status=${r.status} ${r.navError || ""} ${r.nextError ? "NEXT-ERROR-SCREEN" : ""} ${r.pageErrors.join(" | ")}`);

const consoleErrs = results.filter((r) => r.console.length);
line(`\n## Console errors (app, not third-party): ${consoleErrs.length} visits`);
for (const [msg, rs] of Object.entries(group(consoleErrs.flatMap((r) => r.console.map((c) => ({ c, r }))), (x) => x.c.slice(0, 160)))) {
  line(`- ${rs.length}× "${msg}" e.g. [${rs[0].r.role}] ${short(rs[0].r.url)}`);
}

const failed = results.flatMap((r) => r.failed.map((f) => ({ f, r })));
line(`\n## Failed same-origin requests: ${failed.length}`);
for (const [f, rs] of Object.entries(group(failed, (x) => short(x.f).replace(/\?.*$/, "")))) {
  line(`- ${rs.length}× ${f} e.g. [${rs[0].r.role}] ${short(rs[0].r.url)}`);
}

const notFound = results.filter((r) => r.notFound);
// The QA project manager is not a member of the seeded project, so its pages are not found for them by design.
const expected404 = notFound.filter((r) => (r.role === "outsider" && isScoped(r.url)) || (r.role === "pm" && r.url.startsWith("/projects/")));
const unexpected404 = notFound.filter((r) => !expected404.includes(r));
line(`\n## Not-found screens: ${notFound.length} (expected: an outsider on another organisation's project or proposal, or a member not on that project: ${expected404.length})`);
for (const r of unexpected404) line(`- UNEXPECTED [${r.role} ${r.viewport}] ${short(r.url)} -> ${short(r.finalUrl)}${r.fromLinks ? " (found as a link)" : ""}`);

const anon = results.filter((r) => r.role === "anon" && isPlatform(r.url) && r.viewport === 1280);
const badAnon = anon.filter((r) => !r.finalUrl.startsWith("/login"));
line(`\n## Signed-out access to platform pages: ${anon.length} checked, ${badAnon.length} not redirected to /login`);
for (const r of badAnon) line(`- [anon] ${short(r.url)} -> ${short(r.finalUrl)} status=${r.status}`);

const authedToLogin = results.filter((r) => r.role !== "anon" && r.finalUrl.startsWith("/login") && !r.url.startsWith("/login"));
line(`\n## Signed-in users sent to /login (session problems): ${authedToLogin.length}`);
for (const r of authedToLogin.slice(0, 10)) line(`- [${r.role}] ${short(r.url)}`);

const overflow = results.filter((r) => r.viewport === 375 && r.overflow > 2);
line(`\n## Horizontal scroll at 375 px: ${overflow.length}`);
for (const r of overflow) line(`- [${r.role}] ${short(r.url)} overflows by ${r.overflow}px`);

const slow = results.filter((r) => !r.navError).sort((a, b) => b.ms - a.ms).slice(0, 12);
line(`\n## Slowest page loads (load + network idle, production build, local stack)`);
for (const r of slow) line(`- ${r.ms} ms (TTFB ${r.ttfb} ms) [${r.role} ${r.viewport}] ${short(r.url)}`);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
line(`Median TTFB across desktop page visits: ${median(results.filter((r) => r.ttfb).map((r) => r.ttfb))} ms`);

const unnamed = results.filter((r) => r.unnamedCount);
line(`\n## Controls without an accessible name: ${unnamed.length} visits`);
for (const [h, rs] of Object.entries(group(unnamed.flatMap((r) => r.unnamed.map((u) => ({ u, r }))), (x) => x.u.replace(/[0-9a-f-]{36}/g, "…")))) {
  line(`- ${rs.length}× ${h} e.g. ${short(rs[0].r.url)}`);
}
const noAlt = results.filter((r) => r.imgNoAlt);
line(`\n## Images without alt: ${noAlt.length} visits${noAlt.length ? " e.g. " + short(noAlt[0].url) : ""}`);

const axe = results.filter((r) => r.axe).flatMap((r) => r.axe.map((v) => ({ v, r })));
line(`\n## Accessibility (axe, WCAG 2.1 A/AA) on ${results.filter((r) => r.axe).length} visits: ${axe.length} violations`);
for (const [id, vs] of Object.entries(group(axe, (x) => x.v.id)).sort((a, b) => b[1].length - a[1].length)) {
  const pages = [...new Set(vs.map((x) => short(x.r.url)))];
  line(`- ${id} (${vs[0].v.impact}): ${vs[0].v.help} — ${pages.length} pages, ${vs.reduce((n, x) => n + x.v.nodes, 0)} elements`);
  line(`    e.g. ${pages.slice(0, 4).join(", ")}`);
  line(`    target: ${vs[0].v.targets[0] || ""} | ${(vs[0].v.html[0] || "").replace(/\s+/g, " ")}`);
}

const titles = results.filter((r) => r.viewport === 1280 && !r.fromLinks && !r.notFound && r.role === "admin");
const noH1 = titles.filter((r) => r.h1.length === 0);
line(`\n## Admin pages without an h1: ${noH1.length}`);
for (const r of noH1) line(`- ${short(r.url)} (title "${r.title}")`);
const dupTitles = Object.entries(group(titles, (r) => r.title)).filter(([, v]) => v.length > 3);
line(`Titles shared by more than 3 pages: ${dupTitles.map(([t, v]) => `"${t}" ×${v.length}`).join("; ") || "none"}`);

const links = results.filter((r) => r.fromLinks);
const brokenLinks = links.filter((r) => (r.status && r.status >= 400) || r.notFound || r.nextError);
line(`\n## Internal links followed: ${links.length}, broken: ${brokenLinks.length}`);
for (const r of brokenLinks) line(`- [${r.role}] ${short(r.url)} status=${r.status}${r.notFound ? " 404-screen" : ""}`);

console.log(out.join("\n"));
