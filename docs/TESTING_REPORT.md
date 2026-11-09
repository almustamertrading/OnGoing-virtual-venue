# Testing report

Only tests that actually ran are recorded here, with the command and the result.
A feature is **VERIFIED** only when its automated tests pass. Manual or ad-hoc checks do not count.

## Current state

| Area | Command | Tests | Latest local result |
|---|---|---|---|
| Typecheck | `npm run typecheck` | — | PASS |
| Lint (own source; vendored MapLibre worker ignored) | `npm run lint` | — | PASS, 0 problems |
| Unit tests (Vitest) | `npm test` | 20 | PASS |
| Database tests (pgTAP: RLS, capabilities, tenant integrity) | `npx supabase test db` | 53 | PASS |
| Migration data-move check | `./scripts/db/check-rbac-backfill.sh` | 6 checks | PASS |
| End-to-end smoke (Playwright, production build) | `E2E_PROD=1 npx playwright test` | 7 logins + 13 smoke | PASS (20/20) |
| CI pipeline | `.github/workflows/ci.yml` | all of the above | configured; see CI runs |

**How to run locally:**
1. `npx supabase start`
2. `npm run check`
3. `npx supabase test db`
4. `npx playwright test` (uses the local stack only; refuses any other Supabase host).

Before Phase 2, modules were only checked with throw-away scripts against production. Those checks are replaced by the suites above.

## Test runs

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

### 2026-11-09 · CI on release candidate `d5d9727`
- GitHub Actions run 42695122497: **success**. Steps: typecheck, lint, Vitest, local Supabase, pgTAP (RLS, capabilities, tenant integrity), migration data-move check, production build + Playwright smoke tests.
- The previous run (c87f97f) failed lint on a release-evidence script under `docs/`; `docs/` is now excluded from lint, application source is still fully linted.

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
