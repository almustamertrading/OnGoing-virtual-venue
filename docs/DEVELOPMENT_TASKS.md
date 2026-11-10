# Development tasks

The execution backlog for the Phase 2 directive.
- **Priority:** P0 (security or data safety), P1 (quality gate), P2 (product), P3 (polish).
- **Status:** NOT STARTED · IN PROGRESS · BLOCKED · IMPLEMENTED · TESTED · VERIFIED.
- **VERIFIED** requires passing automated tests, recorded in [TESTING_REPORT.md](TESTING_REPORT.md).

## Stage 1: Security and data hygiene

| ID | Task | Pri | Depends on | Status | Evidence / remaining |
|---|---|---|---|---|---|
| S1-1 | Production data inventory, private report, snapshot, reversible cleanup plan | P0 | — | IMPLEMENTED | [cleanup plan](cleanup/CLEANUP_PLAN.md); snapshot verified 31/31 tables; dry run passed. Remaining: owner approval (B-01), then execution |
| S1-1b | Interim risk mitigation: ban QA accounts | P0 | — | IMPLEMENTED | 3 accounts banned, 0 sessions (SECURITY_REPORT) |
| S1-2 | Local dev environment, all migrations verified locally | P0 | — | IMPLEMENTED | `supabase db reset` passes. Remaining: seed fixtures + env script (S2) |
| S1-3 | DB hygiene: 6 unindexed FKs, split `FOR ALL` policies, tenant-safe composite FKs, immutable project organisation | P0 | S1-2 | VERIFIED (local) | Migration `20261109160000`; no unindexed FKs or `FOR ALL` policies remain locally; pgTAP tenant tests pass. Remaining: production (S1-5) |
| S1-4 | Capability RBAC + DB-enforced financial confidentiality, role-permission matrix, unauthorized-access tests | P0 | S1-3 | VERIFIED (local) | Migration `20261109170000`; [matrix](ROLE_PERMISSION_MATRIX.md); 53 pgTAP + smoke 9a/9b pass; Members & Permissions page. Remaining: production (S1-5), contract migration after release |
| S1-5 | Apply S1-3/S1-4 to production after local tests pass; deploy matching app | P0 | S1-4, S2 smoke | BLOCKED (owner approval) | Ready: [readiness report](releases/2026-11-S1-5/READINESS.md); mirror-verified migration and rollback; runbook; approval list |

## Stage 2: Quality engine

| ID | Task | Pri | Depends on | Status |
|---|---|---|---|---|
| S2-1 | Vitest unit setup + tests for money/margin and permissions helpers (shared `src/lib/money.ts` now used by BOQ, proposals, PDF, conversion) | P1 | — | VERIFIED (local) |
| S2-2 | Playwright 1.63.0 (matches preinstalled browsers), login helper, local-only guard | P1 | S1-2 | VERIFIED (local) |
| S2-3 | Seed fixtures: QA org, 7 users by capability, project with finance data (`e2e/support/seed.ts`) | P1 | S1-4 | VERIFIED (local) |
| S2-4 | 12 smoke tests (directive list) | P1 | S2-2, S2-3 | VERIFIED (local, production build) |
| S2-5 | GitHub Actions CI: typecheck, ESLint, unit, DB tests, data-move check, Playwright smoke on a production build | P1 | S2-1..4 | VERIFIED (green on the release candidate; now also runs on `stage3`) |
| S2-6 | ESLint: ignore the vendored MapLibre worker only | P1 | — | VERIFIED (0 problems) |

## Stage 3: Parallel modules (main agent owns migrations and contracts)

| ID | Workstream | Pri | Status |
|---|---|---|---|
| S3-A | Settings & Admin: organisation, members, capabilities, domains, audit log | P2 | VERIFIED (local, `stage3`) |
| S3-B | Calendar & Scheduling | P2 | VERIFIED (local, `stage3`) |
| S3-C | Document management | P2 | VERIFIED (local, `stage3`) |
| S3-D | Reports & Analytics | P2 | VERIFIED (local, `stage3`) |
| S3-E | Integration hardening: confidential activity, upload cleanup, public mail domains, local-date reports | P0 | VERIFIED (local, pgTAP) |

## Stage 4: AI

| ID | Task | Pri | Depends on | Status |
|---|---|---|---|---|
| S4-1 | AI cost control: usage log, rate limits, duplicate guard, provider interface + mock | P0 | — | VERIFIED (local; live AI pending B-05) |
| S4-2 | Proposal Builder Phase 2 (briefs, templates, approvals, comments, revisions, versions, conversion) | P2 | S4-1, S1-4 | VERIFIED (local, mock AI) |
| S4-3 | Secure PDF storage: archive the approved version's PDF into Documents | P2 | S4-2, S3-C | NOT STARTED (needs a server-side PDF renderer decision; today: print view of any frozen version) |

## Stages 5–6

| ID | Task | Pri | Status |
|---|---|---|---|
| S5-1 | Measure, then batch the project workspace count queries into one RPC; stream the workspace header (TD-09) | P2 | NOT STARTED |
| S5-2 | Deduplicate utilities, UI/UX consistency pass | P3 | NOT STARTED |
| S6-1 | Full regression, production build, deployment readiness checklist | P1 | VERIFIED for `stage3` (CI green; 61/61 e2e on a production build) |
| S6-2 | Release S3-4 readiness: mirror verification on production + S1-5, exact rollback, compatibility, pre-flight | P0 | READY (awaiting approval after S1-5, B-11): [report](releases/2026-11-S3-4/READINESS.md) |
