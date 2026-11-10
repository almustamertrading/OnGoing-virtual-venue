# Production readiness: release S3-4 (Stage 3 modules + Proposal Builder Phase 2 + AI cost control)

**Status: READY FOR APPROVAL AFTER RELEASE S1-5. Nothing has been deployed.** Prepared 2026-11-10.

This release is built on release S1-5's schema. **S1-5 must be live and verified first** ([S1-5 readiness](../2026-11-S1-5/READINESS.md)).

## What the release contains
- **Code:** branch `stage3` (Settings & Administration, global calendar, central documents, reports,
  AI cost control, Proposal Builder Phase 2). It is merged into `public-site` only after S1-5 is live;
  the release commit is recorded in the status table below at that point.
- **Database:** two migrations, applied in this order after S1-5's two:
  1. `20261109180000_stage3_modules`: organisation settings, admin audit log, calendar events, documents
     (private storage bucket), report functions, confidential-activity masking, public-mail-domain guard.
  2. `20261109190000_proposals_phase2_ai`: AI usage log and limits, proposal templates, versions,
     reviews, the database-enforced approval workflow, atomic proposal-to-project conversion.

## Evidence

| Check | Result |
|---|---|
| CI on `stage3` | PASS on `f240ddc` (run 42710426791) and `5f77c78` (run 42711325479): typecheck, lint, 252 unit, 160 pgTAP, data-move check, production build + 61 end-to-end |
| Production pre-flight (read-only, counts only) | 0 public mail domains registered, no existing `documents` bucket, 0 name clashes (tables, types, columns, functions, storage policies). 1 organisation, 1 proposal (status "approved internally", version 1) |
| Isolated mirror | Second local stack, rebuilt from production's 10 migrations + production's structure (same IDs, relationships, roles, statuses, amounts; placeholder text), then S1-5's two migrations in one transaction |
| Migration on the mirror (one transaction) | 148 statements, 273 ms wall, slowest statement 5.7 ms. A second connection reading the affected tables never waited more than 238 ms |
| Data | No table lost rows or changed row counts. Only `organizations` and `proposals` changed content: their new columns got defaults (time zone Asia/Riyadh, VAT 15%; empty approval fields). Internal cost total unchanged (1,233,500). Storage: only the new private `documents` bucket and its 4 policies were added |
| S1-5 app + migrated DB (the transition window) | 11/11 key pages load, no errors; the owner keeps every finance view (invoices, quote amounts, stock value SAR 96,700, proposal margin) |
| New app + migrated DB | 21/21 pages load (11 existing + 10 new); same finance values |
| New app + old DB (wrong order) | No crash, but the new features show "could not load" or look empty, and their actions fail. **The database must be migrated first** |
| Database tests on the mirror | pgTAP 160/160 |
| Rollback | `rollback.sql` (one transaction, 143 ms). Migrate, then roll back: the **schema dump, the storage configuration and the data fingerprint of all 33 tables are identical** to before. Data created after go-live is kept in `ops_rollback_s34` (JSON rows). A failing rollback leaves the database unchanged (observed during development). Migrating again afterwards works and gives an identical schema |

**Not proven by the mirror:** production hardware speed and live traffic; Netlify's build; real file
uploads to production storage; live AI calls (no development key, B-05; AI calls are bounded at 55 s,
under the hosting platform's 60 s limit).

## Risks
1. **Locks.** `ALTER TABLE` and policy changes lock `organizations`, `proposals`, `organization_domains`,
   `activity`, `proposal_sections`, `proposal_items` and storage policies until commit: about 0.3 s on the
   mirror. A request may wait briefly; no downtime.
2. **Transition window** (database migrated, Netlify deploying, about 3–5 min), verified with the owner
   account: no change. A non-manager using the old app could not send an unapproved proposal (refused);
   the old app's conversion is not atomic, so avoid conversions during the window.
3. **The existing proposal** is "approved internally" from before the workflow existed, so it has no
   recorded approval: only a manager (the owner is one) can send or convert it, or it can be re-submitted
   and approved. No approval data is invented.
4. **Behaviour changes users will notice:** proposal content is locked during review and after approval;
   public mail domains are refused for automatic membership; AI requests have limits (drafts 10/hour and
   40/day per user, RFP reading 10/hour and 30/day, 3 million tokens per organisation per month), all
   adjustable with `AI_*` environment variables on Netlify. `AI_PROVIDER` must never be set in production.
5. **Order.** S1-5 first, then this release; within it, database first, then app.
6. **Migration history** and **backups:** as for S1-5 (apply-time versions are recorded; an off-site
   dump by the owner is required before go-live).

## Runbook (only after approval, and only after S1-5 is live)
1. **Pre-checks:** S1-5 live and verified; CI green on the release commit; re-run the pre-flight query
   (in `mirror-tools/README.md`); confirm no one else is using the app.
2. **Backup:** (a) fresh snapshot schema `ops_backup_<date>` in production (copies only); (b) the owner's
   off-site dump (as in S1-5).
3. **Apply** migration 1, then migration 2, each atomically.
4. **Verify (read-only):** new tables exist with RLS enabled; Supabase advisors show no new security
   issues; the owner's 21-page check (`mirror-tools/compat_check.cjs` against production, owner account).
5. **Deploy:** merge `stage3` into `public-site`, wait for CI, fast-forward `phase-1-foundation` to the
   release commit. Netlify publishes in about 3–5 min.
6. **Post-deploy checks** (owner): settings, calendar, documents (upload and download one file), reports,
   proposal templates, one proposal through review and approval.
7. Align the repository's migration file names with the recorded versions; update the docs.

**Rollback** (if step 4 or 6 fails): run `rollback.sql` (atomic, verified), then redeploy release S1-5
(`d5d9727`). Data created in between is kept in `ops_rollback_s34`.

## Actions requiring your approval (separate from S1-5)

| # | Action | Type |
|---|---|---|
| 1 | Create a fresh pre-release snapshot schema in production | Production write (non-destructive) |
| 2 | Apply the two migrations to production | Production schema change |
| 3 | Merge `stage3` into `public-site` and fast-forward `phase-1-foundation` to the release commit (Netlify publishes) | Production deploy |

## Status
| Item | Value |
|---|---|
| Release commit | to be set when `stage3` is merged into `public-site` (after S1-5) |
| Verified code | `stage3` at `5f77c78` (CI green) |
