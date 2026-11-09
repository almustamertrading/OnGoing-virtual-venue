# Project status

Last updated: 2026-11-09 · Branch `public-site` · Production deploys from `phase-1-foundation` (Netlify).

Statuses: NOT STARTED · IN PROGRESS · BLOCKED · IMPLEMENTED · TESTED · VERIFIED (automated tests pass).

## Phase 2 directive

| Stage | Scope | Status |
|---|---|---|
| 1 | Security review, cleanup plan, dev environment, DB hygiene, RBAC | VERIFIED locally; production rollout pending (S1-5) |
| 2 | Test engine (Vitest, Playwright, fixtures, 12 smoke tests, CI) | VERIFIED locally; first CI run pending |
| 3 | Settings & Admin, Calendar, Documents, Reports (parallel workstreams) | NOT STARTED |
| 4 | AI cost control, then Proposal Builder Phase 2 | NOT STARTED |
| 5 | Measured performance, UI/UX consistency | NOT STARTED |
| 6 | Full regression, production build, deployment readiness | NOT STARTED |

Detail: [DEVELOPMENT_TASKS.md](DEVELOPMENT_TASKS.md).

## Modules

| Module | Status | Notes |
|---|---|---|
| Auth (email + password, domain auto-join) | VERIFIED (smoke 1–4) | Email confirmation on in production |
| Access control (capabilities, finance confidentiality, tenant integrity) | VERIFIED (53 pgTAP + smoke 9a/9b) | Local; production rollout pending |
| Members & Permissions (admin) | IMPLEMENTED | New; covered by pgTAP at DB level, UI test to add |
| Projects list and creation | VERIFIED (smoke 5) | |
| RFP import → blueprint (AI) | IMPLEMENTED | AI verified live in production only (B-05) |
| Workspace: tasks, pricing/BOQ | VERIFIED (smoke 6, 7) | |
| Workspace: overview, scope, plan, structure, evaluation, team, activity | IMPLEMENTED | Overview prerender bug fixed |
| Venues map editor, comments, 360° panoramas | IMPLEMENTED | |
| Layout editor (CAD blocks) | IMPLEMENTED | |
| Procurement: suppliers | VERIFIED (smoke 8) | RFQ/quote flow: unit-level only |
| Finance (invoices, expenses), Inventory | VERIFIED for permissions (smoke 9) | |
| Proposal Builder Phase 1: create, PDF, convert | VERIFIED (smoke 10–12) | AI draft: production only (B-05) |
| Public marketing site | VERIFIED (smoke 1: loads) | |

## Environments

| Environment | Purpose | Notes |
|---|---|---|
| Production | Supabase project `bbuqakqjmuzxpbwxflhx` + Netlify | No new testing or seeding here (TD-01) |
| Local | Supabase CLI in Docker | Development, seed fixtures, all automated tests |

## Open owner decisions
See [BLOCKERS.md](BLOCKERS.md). The most important are cleanup approval (B-01), the admin password change (B-02)
and making the repository private (B-03).
