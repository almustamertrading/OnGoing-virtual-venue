# Production readiness: release S1-5 (Stage 1 security + Stage 2 test engine)

**Status: READY FOR APPROVAL. Nothing has been deployed.** Prepared 2026-11-09.

## What the release contains
- **Code:** `public-site` (release candidate; exact commit in the status table below), a fast-forward of the deploy branch `phase-1-foundation` (`19e66fc`, live today) by 7 commits.
- **Database:** two migrations, applied in this order after production's latest (`20261109154918_proposals`):
  1. `20261109160000_db_hygiene`: FK indexes, per-command policies, tenant-safe composite keys.
  2. `20261109170000_rbac_capabilities`: capabilities, finance-only data, internal costs moved to finance-only tables (expand phase).

## Evidence

| Check | Result |
|---|---|
| CI on the release candidate | PASS: typecheck, lint, unit, 53 pgTAP, data-move check, production build + 20 smoke tests (run id in the status table below) |
| Production data vs. every new constraint (20 read-only checks on production) | **0 violations**: no cross-tenant links, no duplicates, no negative amounts, all dropped policies exist, organisation has an admin |
| Isolated, representative database | Separate local Supabase stack at production's exact schema version, holding production's structure: same IDs, relationships, roles, statuses and amounts (placeholder text, no personal data) |
| Migration on the mirror (one transaction, like production) | 153 statements, about 110 ms in total, slowest statement 3.9 ms. A second connection reading the affected tables throughout never waited more than 129 ms |
| Data move | All 6 proposal costs (total 1,233,500) and 5 inventory rates (total 10,555) moved exactly; old columns blank; no row counts changed |
| Access on production-shaped data | Owner (admin) keeps every finance view. The QA account that owns the finance project drops from 2 visible invoices to 0 |
| Live app + migrated DB (the transition window) | 11/11 key pages load, no errors. Temporary for the owner: inventory value shows SAR 0 and proposal margins ignore costs. Invoices and quotes stay visible |
| New app + migrated DB | 11/11 pages load; correct values (inventory value SAR 96,700); smoke suite 20/20; pgTAP 53/53 |
| New app + old DB (wrong order) | No crash, but the owner loses finance views. **The database must be migrated first** |
| Rollback | `rollback.sql` (one transaction, 120 ms). Migrate, then roll back: the **schema dump and the full data fingerprint of all 31 tables are identical** to before. Migrating again afterwards works |
| Migration order | Production records apply-time versions. 6 of 10 local files had different numbers (same names and order); renamed to match production. New migrations now sort after production's latest |
| Branch sync | `phase-1-foundation` is an ancestor of `public-site`: plain fast-forward, nothing on the deploy branch is missing from the release |

**Not proven by the mirror:**
- production hardware speed (Free plan) and live concurrent traffic;
- Netlify's build environment;
- clients that cached data during the switch.

Mitigation: release at a quiet time (the owner is the only active user), verify immediately, and use the timed rollback below.

## Risks
1. **Locks.** `ALTER TABLE` holds exclusive locks on about 15 tables until the transaction commits: about 0.1 s on the mirror, expected under 2 s in production. A request may wait briefly; no downtime.
2. **Transition window** (database migrated, Netlify deploying for about 3–5 min). The owner sees stock value 0 and margins without costs. Cost edits made in the old app during this window are kept: a trigger moves them into the finance table.
3. **Order.** Database first, then app. An app-first mistake hides finance from the owner until the migration is applied. No data is lost.
4. **Migration history.** The Supabase connector records the time of application, not the file's version. After applying, the repository files will be renamed to the recorded versions (no SQL change). Alternatively, `supabase db push` keeps file versions but needs the database password.
5. **Backups.** The Free plan has no platform backups. The existing in-database snapshot `ops_backup_20261109` lives in the same database: it protects against data mistakes, not project loss. An off-site dump by the owner is required before go-live.

## Runbook (only after approval)
1. **Pre-checks:**
   - CI is green on the release candidate.
   - Re-run the 20 read-only constraint checks.
   - Record the cost and rate totals.
   - Confirm no one else is using the app.
2. **Backup:**
   - (a) I create a fresh snapshot schema `ops_backup_<date>` in production (a write: copies only).
   - (b) The owner runs an off-site dump: `npx supabase db dump --db-url "<connection string>" -f backup.sql`, plus `--data-only` and `--role-only` variants. The connection string is in Supabase → Project Settings → Database.
3. **Apply** migration 1, then migration 2, each atomically.
4. **Verify (read-only):**
   - totals moved match step 1;
   - RLS on every table;
   - Supabase advisors show no new security issues;
   - owner access check.
5. **Deploy:** fast-forward `phase-1-foundation` to the release commit. Netlify builds and publishes in about 3–5 min.
6. **Post-deploy checks** (owner account): projects, Finance tab, Procurement quotes, inventory value, proposal margin and PDF, Members & Permissions.
7. Align the repository's migration file names with the recorded versions; update the docs.
8. **Later, separate approval:** a contract migration that drops the now-empty old cost columns, after some days of stable use.

**Rollback** (if step 4 or 6 fails):
- Run `rollback.sql` (atomic, about 0.1 s, verified).
- Re-publish the previous Netlify deploy (instant), or reset the deploy branch to `19e66fc`.
- Costs entered meanwhile are copied back, so nothing is lost.

## Actions requiring your approval

| # | Action | Type |
|---|---|---|
| 1 | Create a fresh pre-release snapshot schema in production | Production write (non-destructive) |
| 2 | Apply the two migrations to production | Production schema change |
| 3 | Fast-forward `phase-1-foundation` to the release commit (Netlify publishes) | Production deploy |

**Your own actions** (I cannot do these):
- off-site database dump (step 2b);
- admin password rotation ([checklist](../../security/CREDENTIAL_ROTATION_CHECKLIST.md));
- making the repository private ([steps](../../security/MAKE_REPOSITORY_PRIVATE.md)).
- **Optional:** the Pro plan, for daily backups and leaked-password protection.

## Status
| Item | Value |
|---|---|
| Release candidate commit | see the commit that adds this file on `public-site` |
| CI run on that commit | recorded in docs/TESTING_REPORT.md once finished |
