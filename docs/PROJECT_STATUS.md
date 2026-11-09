# Project status

Last updated: 2026-11-09 · Branch `public-site` · Production deploys from `phase-1-foundation` (Netlify).

Statuses: NOT STARTED · IN PROGRESS · BLOCKED · IMPLEMENTED · TESTED · VERIFIED (automated tests pass).

## Phase 2 directive

| Stage | Scope | Status |
|---|---|---|
| 1 | Security review, cleanup plan, dev environment, DB hygiene, RBAC | IN PROGRESS |
| 2 | Test engine (Vitest, Playwright, fixtures, 12 smoke tests, CI) | NOT STARTED |
| 3 | Settings & Admin, Calendar, Documents, Reports (parallel workstreams) | NOT STARTED |
| 4 | AI cost control, then Proposal Builder Phase 2 | NOT STARTED |
| 5 | Measured performance, UI/UX consistency | NOT STARTED |
| 6 | Full regression, production build, deployment readiness | NOT STARTED |

Detail: [DEVELOPMENT_TASKS.md](DEVELOPMENT_TASKS.md).

## Modules

| Module | Status | Notes |
|---|---|---|
| Auth (email + password, domain auto-join) | IMPLEMENTED | Email confirmation on in production |
| Projects list, creation, RFP import → blueprint | IMPLEMENTED | AI extraction verified live in production only (B-05) |
| Workspace: overview, scope, plan, pricing, structure, evaluation, tasks, team, activity | IMPLEMENTED | |
| Venues map editor, comments, 360° panoramas | IMPLEMENTED | |
| Layout editor (CAD blocks) | IMPLEMENTED | |
| Procurement (suppliers, RFQs, quotes) | IMPLEMENTED | Quotes become finance-restricted in S1-4 |
| Finance (invoices, expenses), Inventory | IMPLEMENTED | Finance-restricted in S1-4 |
| Proposal Builder Phase 1 | IMPLEMENTED | Costs and margins finance-restricted in S1-4 |
| Public marketing site | IMPLEMENTED | |

No module is TESTED or VERIFIED yet. The automated test engine is Stage 2.

## Environments

| Environment | Purpose | Notes |
|---|---|---|
| Production | Supabase project `bbuqakqjmuzxpbwxflhx` + Netlify | No new testing or seeding here (TD-01) |
| Local | Supabase CLI in Docker | Development, seed fixtures, all automated tests |

## Open owner decisions
See [BLOCKERS.md](BLOCKERS.md). The most important are cleanup approval (B-01), the admin password change (B-02)
and making the repository private (B-03).
