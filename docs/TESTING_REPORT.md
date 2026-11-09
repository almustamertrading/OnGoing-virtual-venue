# Testing report

Only tests that actually ran are recorded here, with the command and the result.
A feature is **VERIFIED** only when its automated tests pass. Manual or ad-hoc checks do not count.

## Current state

| Area | Automated tests | Status |
|---|---|---|
| Unit tests (Vitest) | None yet (Stage 2) | — |
| Database / RLS tests (pgTAP) | None yet (S1-4) | — |
| End-to-end smoke tests (Playwright) | None yet (Stage 2) | — |
| CI pipeline | None yet (Stage 2) | — |

Before Phase 2, each module was checked during development with throw-away Playwright scripts run against
production. Those scripts are not in the repository and are not repeatable, so no module is VERIFIED yet.

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
