# Testing report

Only tests that actually ran are recorded here, with the command and the result.
A feature is **VERIFIED** only when its automated tests pass. Manual or ad-hoc checks do not count.

## Current state

| Area | Command | Tests | Latest local result |
|---|---|---|---|
| Typecheck | `npm run typecheck` | — | PASS |
| Lint (own source; vendored MapLibre worker ignored) | `npm run lint` | — | PASS, 0 problems |
| Unit tests (Vitest) | `npm test` | 436 | PASS (`stage3`) |
| Database tests (pgTAP: RLS, capabilities, tenant integrity, Stage 3, Proposal Phase 2, AI findings, quote award, operations, management summary, BOQ extraction, snapshots) | `npx supabase test db` | 284 | PASS (`stage3`, fresh reset) |
| Migration data-move check | `./scripts/db/check-rbac-backfill.sh` | 6 checks | PASS |
| End-to-end (Playwright, production build): smoke, account, settings, calendar, documents, reports, proposal workflow, requirements, quote comparison, operations, BOQ checker, management summary, BOQ extraction | `E2E_PROD=1 npx playwright test` | 8 logins + 79 tests | PASS (87/87, `stage3`) |
| CI pipeline | `.github/workflows/ci.yml` | all of the above | configured; see CI runs |

**How to run locally:**
1. `npx supabase start`
2. `npm run check`
3. `npx supabase test db`
4. `npx playwright test` (uses the local stack only; refuses any other Supabase host).

Before Phase 2, modules were only checked with throw-away scripts against production. Those checks are replaced by the suites above.

## Test runs

### 2026-11-10 · Weekly management snapshots (Workflow F, increment 2)
- **Database:** `npx supabase db reset` then `npx supabase test db`. PASS, 284 of 284 (new `management_snapshots.test.sql`: 9 — own snapshot recorded; one per week; weeks start on Sunday; finance figures refused; no snapshot for someone else; no updates; not readable even by an organisation admin; not from another organisation; read back unchanged).
- **Bug found and fixed before commit:** UPDATE on the new table did not raise an error because Supabase's default privileges grant it to `authenticated` (RLS still blocked every row, silently). The migration now revokes all privileges and grants only select, insert and delete.
- **Unit:** `npx vitest run`. PASS, 436 of 436 (new: Sunday week start across a year end, stored facts exclude finance, change per fact against the previous snapshot, which direction is better).
- **Full suite:** `E2E_PROD=1 npx playwright test`. PASS, 87 of 87 (production build, 2.5 min).
- **End-to-end:** `E2E_NAMESPACE=summary E2E_PORT=3210 npx playwright test e2e/summary.spec.ts`. PASS, 8 logins + 4 of 4: with last week's snapshot seeded, the overdue figure shows `+N` in red where N equals the database count, figures missing from that snapshot and finance figures show no change, and this week's snapshot is recorded after the page renders with the same figures and no finance keys; a user without a previous snapshot sees the explanation instead.

### 2026-11-10 · AI BOQ extraction with per-line human verification (Workflow B, increment 2)
- **Database:** `npx supabase test db`. PASS, 275 of 275 (new `boq_extraction.test.sql`: 14 — feature logged; a viewer cannot verify; an accepted line joins the BOQ with quantity, unit, item number and source and no price; the finding records who verified it and what it became; decided once; a missing quantity stays empty; wrong kinds refused; BOQ lines and requirements cannot link to another project's finding, a same-project link is allowed; deleting the finding keeps the verified line).
- **Unit:** `npx vitest run`. PASS, 432 of 432 (new `boq-extract.test.ts` 11: quantity normalisation and refusal of ranges, percentages and words; quote and quantity checks; missing quantities never guessed; Arabic lines and digits; page correction; invented quotes unverified; mock output; schema; prompt fencing).
- **End-to-end:** `E2E_NAMESPACE=boqx E2E_PORT=3211 npx playwright test e2e/boq-extract.spec.ts`. PASS, 8 logins + 3 of 3 on a real two-page text PDF with the mock AI: three lines extracted with page 2, quotes and checks (two quantities found in their quotes, one missing); nothing in the BOQ before verification; a verified line joins the BOQ with its item number, quantity and source badge; a rejected line never does; the database links accepted findings and BOQ lines both ways and records the verifier; a viewer sees the lines and decisions but cannot extract or verify.
- **Full suite:** `E2E_PROD=1 npx playwright test`. PASS, 87 of 87 (production build, 2.6 min).
- **Bug found and fixed:** the shared PDF reader refused files with under 200 characters of text as scans, which also refused a short genuine BOQ. It now counts non-space characters with a threshold of 60; scans without a text layer still yield almost none.

### 2026-11-10 · Workspace tabs: instant-navigation warnings (TD-09 correction)
- **Check (development server, not a test suite):** a Playwright script signed in as the QA admin opened every workspace tab on `next dev` against the local stack, and the server log was searched for "uncached data". Before: tasks, pricing, finance and activity logged it (4 of 7 sampled tabs; the three with their own `loading.tsx` did not). After adding `loading.tsx` to the 13 tabs without one: 0 warnings across all 17 tabs and the summary, reports and projects pages. The venues tab never reaches network idle because its map requests external tiles the sandbox blocks; it was checked with a load-based wait.
- **Regression:** full end-to-end suite rerun on a production build (see the Current state table).

### 2026-11-10 · New proposals take the organisation default VAT
- **End-to-end:** `E2E_NAMESPACE=proposals E2E_PORT=3205 npx playwright test e2e/proposals-workflow.spec.ts`. PASS, 8 logins + 6 of 6; test 1 now sets the organisation default VAT to 5% (service role), creates a proposal as sales and checks the VAT field and totals label show 5%; the default is restored to 15% after the spec.

### 2026-11-10 · Management summary (Workflow F)
- **Database:** `npx supabase db reset` then `npx supabase test db`. PASS, 261 of 261 (new `management_summary.test.sql`: 31 — every section counted from live data as the caller; finance facts null without finance access; quote counts hidden without project finance access; a project manager outside a project sees none of its facts; only managers save briefs; a finance-based brief needs finance access; briefs readable by their author and organisation admins only; other organisation-level findings unchanged; author reviews own brief; other organisations refused).
- **Bug caught by the existing suite before commit:** the first draft of the migration rewrote the findings insert policy and dropped its finance-only clause; `ai_findings_tender.test.sql` failed two assertions, the clause was restored and a new assertion pins it.
- **Local migration history repaired:** the three earlier Stage 7 migrations had been applied with psql and were missing from the local history, so `migration up` tried to re-apply them. A full `db reset` re-applied all 31 migrations cleanly from scratch.
- **Unit:** `npx vitest run`. PASS, 421 of 421 (new `management.test.ts` 16: database JSON reading, facts and labels, estimates, finance gating, rule order and reasons, number extraction, recommendation checks for unknown facts and unsupported numbers, mock output, schema, prompt fencing; `format.test.ts`: Arabic day counts).
- **End-to-end:** `E2E_NAMESPACE=summary E2E_PORT=3210 npx playwright test e2e/summary.spec.ts e2e/operations.spec.ts e2e/requirements.spec.ts`. PASS, 8 logins + 15 of 15. Summary: admin sees every section, the overdue total equals a direct database count, finance details and rule suggestions; AI recommendations (mock) verified, accepted and rejected with a note, stored finance-only as the admin's; a sales editor sees the project's facts but no finance, quote counts or briefs (the invoice number is absent from the page); a project manager outside the project sees none of its facts and none of the admin's recommendations.
- **Full suite:** `E2E_PROD=1 npx playwright test`. PASS, 84 of 84 (production build, 2.7 min).
- **Visual check:** desktop and 375 px screenshots reviewed; detail rows now keep a minimum title width so badges wrap below on phones.

### 2026-11-10 · BOQ checker (Workflow B rules), merged from a parallel worktree
- **Unit:** `npx vitest run`. PASS, 404 of 404 on the merged tree (new `boq-check.test.ts`: 110 — every rule, severities and order, Arabic and English normalisation, units, duplicates and conflicts, provisional sums, finance-only checks and their absence without finance access, categories).
- **End-to-end (worktree):** `E2E_NAMESPACE=boqcheck E2E_PORT=3206 npx playwright test e2e/boq-check.spec.ts`. PASS, 8 logins + 5 of 5 (sales on the Pricing tab, finance on a proposal with below-cost and low-margin lines, non-finance proposal view with no cost checks, 375 px on both pages); boq-check + reports + smoke together 35 of 35 (no leftovers for exact-figure specs).
- **Full suite on the merged tree:** `E2E_PROD=1 npx playwright test`. PASS, 80 of 80 (8 logins + 72 tests, production build, 2.9 min), with Workflow E and the BOQ checker together.
- **Review before merge:** `unit_cost` is passed to the checker only when the viewer may see costs, finance messages show a margin percentage and never an amount, and the panel changes no data.

### 2026-11-10 · Event operations: reports, risk log, AI action items (Workflow E)
- **Database:** `npx supabase test db`. PASS, 230 of 230 (new `ops_reports.test.sql`: 22 — members read and editors write reports and the log, viewers and outsiders refused, owner must belong to the project or organisation, an action item becomes a task in one transaction with the suggested assignee and due date, an assignee outside the project and organisation is dropped, issues and risks join the log with their source report, likelihood only for risks, decide once, wrong kinds refused, viewers cannot accept).
- **Unit:** `npx vitest run`. PASS, 294 of 294 (new `ops.test.ts` 15: whole-word assignee matching, parsing, excerpt verification, dates, defaults, caps, mock output, schema shape, prompt fencing; `format.test.ts`: strict ISO dates).
- **End-to-end:** `E2E_NAMESPACE=operations E2E_PORT=3209 npx playwright test e2e/operations.spec.ts e2e/requirements.spec.ts`. PASS, 8 logins + 11 of 11 with the mock AI: create and edit a venue inspection report; extraction with verified excerpts and a suggested assignee; a repeat run held back by the duplicate guard; accepted action item becomes a task (assignee, due date, decision trail checked in the database); issues and risks join the log linked to the report; rejection with a note; decision recorded; owner, status, manual entry and closing in the log; viewer read-only. The tender spec re-ran because its date parsing changed.
- **Bug found and fixed:** `Date.parse` accepts impossible dates such as 2027-02-30 (it rolls them into March), so the tender and operations parsers could show such a date on a finding card. The database already discarded it on accept. Both parsers now use a strict `isIsoDate`.

### 2026-11-10 · Supplier quote comparison and award (Workflow D)
- **Database:** PASS, 208 of 208 (new `quotes_award.test.sql`: 16 — comparison fields, no pre-awarded inserts, reason required, unpriced not awardable, award stamped with who/when/why, others set aside, RFQ awarded, award details immutable, one award per RFQ, award can move with a new reason, finance viewers and non-finance editors cannot award).
- **Unit:** `quote-compare.test.ts` 7 of 7 (lowest and percentages, validity, late delivery, missing data, recommendation rules, mixed bases, rejected quotes).
- **End-to-end:** `E2E_NAMESPACE=quotes E2E_PORT=3208 npx playwright test e2e/quote-comparison.spec.ts`. PASS, 3 of 3 (finance viewer sees flags and the labelled recommendation but cannot award; admin edits details and awards with a reason, recorded; non-finance editor sees no prices).

### 2026-11-10 · Shared AI findings + tender requirements register (Workflow A)
- **Database:** `npx supabase test db`. PASS, 192 of 192 (new `ai_findings_tender.test.sql`: 32 — proposals only, provenance immutable, reviewer stamped by the database, decide once / reopen, finance-only gating, owner and evidence rules, calendar feed, activity log, document deletion not blocked).
- **Unit:** `npx vitest run`. PASS, 270 of 270 (new: excerpt location and page correction with Arabic normalisation, page budgeting, tender output parsing and verification, mock output, compliance arithmetic).
- **End-to-end:** `E2E_NAMESPACE=requirements E2E_PORT=3207 npx playwright test e2e/requirements.spec.ts`. PASS, 5 of 5 on a real three-page text PDF with the mock AI: analysis, verified page sources, accept to register, reject with note, owner/evidence/status and compliance, calendar entry linking back, viewer read-only.

### 2026-11-09 · Stage 3 + Proposal Phase 2 integration on `stage3` (local)
- **Migrations from scratch:** `npx supabase db reset`. PASS: all 12 migrations applied in order, including `20261109180000_stage3_modules` and `20261109190000_proposals_phase2_ai`.
- **Database tests:** `npx supabase test db`. PASS, 158 of 158 (access control 53, Stage 3 46, Proposal Phase 2 59), on the freshly reset database; then 160 of 160 after adding two storage-policy assertions (an uploader sees only their own unclaimed upload).
- **Unit tests:** `npx vitest run`. PASS, 252 of 252 in 13 files (new: AI limits and duplicate guard, draft parsing, workflow moves, templates, date formatting, public mail domains; plus the Stage 3 modules' tests).
- **Typecheck and lint:** PASS (after `next typegen`).
- **End-to-end, production build, every spec in one organisation** (`E2E_PROD=1 npx playwright test`), first run: 57 passed, 4 failed. All four were specs interfering through shared data, not product defects: the settings spec left the currency as AED (smoke 7 and 11 expected SAR), the calendar spec left a milestone on the shared project (reports expected 1/2 milestones), and other specs' activity pushed the invoice line out of the overview's 8 most recent lines (smoke 9b). Fixed: the settings and calendar specs restore or remove what they change, and smoke 9a/9b check the full activity log (which also makes 9a's "hidden" check meaningful again).
- **Proposal workflow e2e** (`e2e/proposals-workflow.spec.ts`, mock AI): 6 of 6 in its own namespace and in the full run.
- **End-to-end rerun after the fixes** (production build, all specs, one organisation): PASS, 61 of 61 (8 sign-ins + 53 tests) in 1.7 min.
- **CI on `stage3`** (GitHub Actions run 42710426791, commit `f240ddc`): PASS, every step (typecheck, lint, Vitest, local Supabase, pgTAP, migration data-move check, production build + Playwright).

### 2026-11-09 · Local migrations from scratch
- **Command:** `npx supabase db reset` (local stack, Postgres 17.11)
- **Result:** PASS. All 10 migrations applied in order without errors.

### 2026-11-09 · Production snapshot integrity
- **Check:** row counts of every table in `ops_backup_20261109` compared with the live tables.
- **Result:** PASS. 31 of 31 tables and 430 of 430 rows match, plus 4 auth users and 3 storage-object rows. `has_schema_privilege` is false for `anon` and `authenticated`.

### 2026-11-09 · Cleanup and restore dry run (local, synthetic mirror)
- **Setup:** synthetic rows with the same UUIDs as the production Group A records, plus records to keep.
- **Counts:** projects | clients | users | members | layout items | scope items

  | Step | Counts | Expected |
  |---|---|---|
  | Before | `5 \| 3 \| 4 \| 8 \| 1 \| 1` | — |
  | After `cleanup_group_a.sql` | `1 \| 1 \| 1 \| 1 \| 0 \| 0` | only kept records remain |
  | After `restore_from_snapshot.sql` | `5 \| 3 \| 4 \| 8 \| 1 \| 1` | identical to before |

- **Result:** PASS.

### 2026-11-09 · Snapshot guards
- **Command:** both scripts run with `psql -v ON_ERROR_STOP=1` against a fresh local database with no snapshot schema.
- **Result:** PASS. Both refused to run and changed nothing:
  - cleanup: `Refusing to run: snapshot schema ops_backup_20261109 is missing`
  - restore: `Snapshot schema ops_backup_20261109 is missing`

### 2026-11-09 · Hygiene + RBAC migrations, database tests
- **Command:** `npx supabase db reset --local && npx supabase test db`
- **Result:** PASS, 53/53. Acting as admin, finance, sales, operations, project manager, viewer, external partner and another organisation's admin, the tests confirm:
  - finance reads and writes;
  - internal costs never readable without finance access;
  - capability-gated creation;
  - members cannot grant themselves capabilities;
  - `organization_admin` is never stored;
  - the last admin cannot step down;
  - five cross-tenant attacks are rejected: proposal item injection, cross-project comment reply, quote/RFQ project mismatch, foreign supplier on a quote, project moved to another organisation.
- **Negative control:** the same attack run against the old schema (migration 20261109154918) succeeded. Another organisation attached an item to a proposal, and plain staff read the internal cost (100.00). So the tests detect the real weaknesses.

### 2026-11-09 · RBAC data move (expand phase)
- **Command:** `./scripts/db/check-rbac-backfill.sh` (reset to 20261109160000, load synthetic rows, migrate, assert).
- **Result:** PASS.
  - Proposal costs: 2 rows / 350.50 copied.
  - Inventory rates: 2 rows / 40.00 copied, including a zero rate; a null rate stays absent.
  - Old columns blanked, `updated_at` preserved.
  - Managers got `{project_manager, sales_access, operations_access}`.
- **Bug found and fixed:** the first run failed with `cannot ALTER TABLE "proposal_item_costs" because it has pending trigger events`. The deferred foreign key checks were still queued. Fixed by enabling RLS when the tables are created and running `SET CONSTRAINTS … IMMEDIATE` after the copy.

### 2026-11-09 · Smoke suite (Playwright)
- **Command:** `E2E_PROD=1 npx playwright test` (production build of the app + local Supabase, seeded by `e2e/global-setup.ts`).
- **Result:** PASS, 20/20 (7 role logins + 13 smoke tests covering the directive's 12, with finance split into hidden/visible).
- **Covered:**
  1. App loads.
  2. Login.
  3. Member opens project.
  4. Signed-out user redirected to login; outsider gets "not found".
  5. Project creation.
  6. Task create and status update, persisted.
  7. BOQ lines and total.
  8. Supplier added.
  9. Finance enforcement:
     - for sales: no Finance tab, restricted page, no quotes, no stock value, no cost column, cost absent from the page payload, finance activity hidden;
     - for finance: all of it visible.
  10. Proposal created with an `ONG-PRO-` reference.
  11. Client PDF generated (`%PDF`), totals 69,000, no internal cost.
  12. Accepted proposal converted to a project with its BOQ.
- **Bugs found and fixed:**
  - **Dev-mode tests never hydrated.** The tests opened `127.0.0.1`, and the Next.js dev server only serves its scripts to `localhost`. Fixed by using a `localhost` base URL.
  - **Project Overview page (real app bug).** It read the current date during prerender, which Next.js 16 Cache Components forbids. An outsider's project URL then hung on "Loading…" instead of showing "not found". Fixed with `await connection()`.
  - **Server Supabase client (real app bug).** Supabase Auth checks token expiry against the clock during partial prefetch, which logged "unstable value Date.now()" errors on 6 routes. Fixed with `await connection()` in the server client. The production-mode run now has 0 such errors.

### 2026-11-09 · Release S1-5 verification on an isolated production-shaped mirror
- **Setup:** a second local Supabase stack (ports 553xx) at production's schema version, loaded with production's structure: same IDs, relationships, roles, statuses and amounts, with placeholder text. Tools: `docs/releases/2026-11-S1-5/mirror-tools/`.
- **Constraint pre-flight on production (20 read-only checks):** PASS, 0 violations.
- **Migrations in one transaction:** PASS. 153 statements, about 110 ms; concurrent reads never waited more than 129 ms.
- **Data move:** PASS. 6 costs (1,233,500) and 5 rates (10,555) moved exactly; row counts unchanged.
- **Compatibility:**

  | App | Database | Result |
  |---|---|---|
  | live (`19e66fc`) | migrated | 11/11 pages OK; temporary display limits for the owner |
  | release candidate | migrated | 11/11 OK, smoke 20/20, pgTAP 53/53 |
  | release candidate | old | owner loses finance views, which proves "database first" |
  | live | old | baseline OK |

- **Rollback:** PASS. After migrate and then roll back, the schema dump and the full data fingerprint (31 tables) are identical to before (0 diff lines). Migrating again afterwards also passes.
- **Bug found and fixed:** the first rollback run stopped. Part A did not recreate the hygiene-level proposal policies that Part B drops. The single transaction kept the database unchanged.
