# Production data cleanup plan

Status: **AWAITING OWNER APPROVAL. Nothing has been deleted.**
Prepared: 2026-11-09. Repository is public, so this file lists record IDs, codes and evidence
categories only. The full report with names was delivered to the owner privately.

## 1. Safety net (done)

| Item | Status | Evidence |
|---|---|---|
| Full pre-cleanup snapshot | Done | Schema `ops_backup_20261109` in prod: 31/31 tables and 430/430 rows match live; 4 users, 3 storage-object rows. |
| Snapshot not reachable by API roles | Done | `has_schema_privilege('anon'|'authenticated', …)` = false; schema not exposed by PostgREST. |
| Cleanup script | Ready, **not run** | [`cleanup_group_a.sql`](cleanup_group_a.sql) — single transaction, refuses to run without the snapshot. |
| Restore script | Ready | [`restore_from_snapshot.sql`](restore_from_snapshot.sql) — restores by ID set, tolerant of later schema changes. |
| Dry run of cleanup + restore | Passed (local Supabase, synthetic mirror with the same UUIDs) | Before `5|3|4|8|1|1` → after cleanup `1|1|1|1|0|0` → after restore `5|3|4|8|1|1` (projects, clients, users, members, layout items, scope items). |
| Interim risk mitigation | Done | All three QA accounts (`f0b3270f-…`, `703fd035-…`, `dd88c9dd-…`) banned (`banned_until = 2999-01-01`) and their sessions revoked. Reversible: set `banned_until = null`. No data removed. |

## 2. Classification

### Group A — QA/test artifacts (strong evidence) → recommended for removal

| Record | Evidence |
|---|---|
| Projects 2027-001, 2027-002, 2027-003 | Three identically named "E2E …" projects created 7 minutes apart on 2026-11-04 during automated end-to-end testing; generic test client; 2027-003 holds the map + 360° test data. |
| Project 2027-004 | Created by the QA account during the Layout editor demo (2026-11-05); name and client are explicitly labelled as a test. |
| Clients `71b29a9e-…`, `0647b50a-…` | Referenced only by the projects above. |
| Owner grant of QA account on project 2022-001 | Added only to take screenshots. |
| Users `f0b3270f-…` (QA layout demo), `703fd035-…` (`.test` domain partner), `dd88c9dd-…` (staff editor) | Created by the developer for permission and co-editing tests; their only project memberships are the E2E projects above (plus the grant listed). |
| Storage: demo floor plan, E2E 360° photo, orphaned RFP temp upload | Belong to Group A projects, or are leftovers of a failed upload (see SECURITY_REPORT S-07). |

### Group B — demo data built at the owner's request → **owner decides**
- Project 2022-001 (built from a real tender document as a full end-to-end demo) with its client,
  proposal ONG-PRO-2026-0001, RFQ/quotes, invoices, expenses.
- Organisation-level demo rows: 4 suppliers, 5 inventory items.
- Five lead projects created from real tender PDFs (2023-001, 2023-002, 2023-003, 2026-002, 2026-003)
  and their three clients — the owner asked to register them "as test participants", but they hold
  realistic business data.

### Group C — origin uncertain → **keep unless the owner confirms**
- Project 2026-001 (empty lead, created 2026-11-04 from the primary account; may have been created by
  the owner on their phone).

### Keep
- Primary account (`5ac7937e-…`) — actively used by the owner.
- Organisation, company domains, all migrations.

## 3. Execution order (after approval)
1. Re-verify the snapshot exists (the script checks this).
2. Run `cleanup_group_a.sql` (projects → clients → grant → users, one transaction).
3. Remove the listed storage objects via the Storage API or dashboard.
4. Re-run the inventory queries; record before/after counts in TESTING_REPORT.md.
5. Keep the snapshot for 30 days, then drop it: `drop schema ops_backup_20261109 cascade;`

## 4. Owner approval checklist
- [ ] Approve Group A as listed (or strike items).
- [ ] Decide Group B: keep as demo / remove / move to the local dev database as fixtures.
- [ ] Confirm Group C.
- [ ] Approve storage-object removal.
