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
| S1-3 | DB hygiene: 6 unindexed FKs, split `FOR ALL` policies, tenant-safe composite FKs, immutable project organisation | P0 | S1-2 | NOT STARTED | — |
| S1-4 | Capability RBAC + DB-enforced financial confidentiality, role-permission matrix, unauthorized-access tests | P0 | S1-3 | NOT STARTED | — |
| S1-5 | Apply S1-3/S1-4 to production after local tests pass; deploy matching app | P0 | S1-4, S2 smoke | NOT STARTED | — |

## Stage 2: Quality engine

| ID | Task | Pri | Depends on | Status |
|---|---|---|---|---|
| S2-1 | Vitest unit setup + tests for money/margin, RFP parsing helpers, permissions helpers | P1 | — | NOT STARTED |
| S2-2 | Playwright setup (pinned to the preinstalled browsers), auth helpers, local-only guard | P1 | S1-2 | NOT STARTED |
| S2-3 | Seed fixtures: QA org and users per capability, synthetic projects | P1 | S1-4 | NOT STARTED |
| S2-4 | 12 smoke tests (directive list) | P1 | S2-2, S2-3 | NOT STARTED |
| S2-5 | GitHub Actions CI: typecheck, ESLint, unit, DB tests, Playwright smoke, build | P1 | S2-1..4 | NOT STARTED |
| S2-6 | ESLint: ignore the vendored MapLibre worker only | P1 | — | NOT STARTED |

## Stage 3: Parallel modules (main agent owns migrations and contracts)

| ID | Workstream | Pri | Status |
|---|---|---|---|
| S3-A | Settings & Admin: organisation, members, capabilities, domains | P2 | NOT STARTED |
| S3-B | Calendar & Scheduling | P2 | NOT STARTED |
| S3-C | Document management | P2 | NOT STARTED |
| S3-D | Reports & Analytics | P2 | NOT STARTED |

## Stage 4: AI

| ID | Task | Pri | Depends on | Status |
|---|---|---|---|---|
| S4-1 | AI cost control: usage log, rate limits, duplicate guard, provider interface + mock | P0 | — | NOT STARTED |
| S4-2 | Proposal Builder Phase 2 (briefs, templates, approvals, comments, revisions, versions, documents, conversion) | P2 | S4-1, S1-4 | NOT STARTED |

## Stages 5–6

| ID | Task | Pri | Status |
|---|---|---|---|
| S5-1 | Measure, then batch the project workspace count queries into one RPC | P2 | NOT STARTED |
| S5-2 | Deduplicate utilities, UI/UX consistency pass | P3 | NOT STARTED |
| S6-1 | Full regression, production build, deployment readiness checklist | P1 | NOT STARTED |
