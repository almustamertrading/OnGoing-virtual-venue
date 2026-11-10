# Project status

Last updated: 2026-11-10 · Development branch `stage3` · Release candidate `public-site` · Production deploys from `phase-1-foundation` (Netlify).

Statuses: NOT STARTED · IN PROGRESS · BLOCKED · IMPLEMENTED · TESTED · VERIFIED (automated tests pass).

## Phase 2 directive

| Stage | Scope | Status |
|---|---|---|
| 1 | Security review, cleanup plan, dev environment, DB hygiene, RBAC | VERIFIED locally; production rollout pending (S1-5) |
| 2 | Test engine (Vitest, Playwright, fixtures, 12 smoke tests, CI) | VERIFIED (CI green on the release candidate) |
| 3 | Settings & Admin, Calendar, Documents, Reports (parallel workstreams) | VERIFIED locally on `stage3` (not released) |
| 4 | AI cost control, then Proposal Builder Phase 2 | VERIFIED locally on `stage3` with the mock AI; live AI pending (B-05); secure PDF storage remaining |
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
| RFP import → blueprint (AI) | IMPLEMENTED | Now through the cost-controlled AI runner; live AI verified in production only (B-05) |
| Workspace: tasks, pricing/BOQ | VERIFIED (smoke 6, 7) | |
| Workspace: overview, scope, plan, structure, evaluation, team, activity | IMPLEMENTED | Overview prerender bug fixed |
| Venues map editor, comments, 360° panoramas | IMPLEMENTED | |
| Layout editor (CAD blocks) | IMPLEMENTED | |
| Procurement: suppliers | VERIFIED (smoke 8) | RFQ/quote flow: unit-level only |
| Finance (invoices, expenses), Inventory | VERIFIED for permissions (smoke 9) | |
| Proposal Builder Phase 1: create, PDF, convert | VERIFIED (smoke 10–12) | Conversion is now one database transaction |
| Proposal Builder Phase 2: templates, AI drafts, review and approval, versions, version PDF | VERIFIED locally (59 pgTAP + proposals-workflow e2e, mock AI) | `stage3`; live AI pending (B-05) |
| AI cost control (usage log, limits, duplicate guard, budget) | VERIFIED locally (pgTAP + unit) | TD-07 |
| Settings & Administration (organisation, domains, audit log, account security) | VERIFIED locally (settings + account e2e, pgTAP) | `stage3` |
| Global calendar | VERIFIED locally (calendar e2e, pgTAP) | `stage3` |
| Central documents | VERIFIED locally (documents e2e, pgTAP) | `stage3` |
| Reports & analytics | VERIFIED locally (reports e2e, pgTAP) | `stage3` |
| Tender requirements register (AI, Workflow A) | VERIFIED locally (32 pgTAP + requirements e2e, mock AI) | `stage3` |
| Supplier quote comparison and reasoned award (Workflow D) | VERIFIED locally (16 pgTAP + quote-comparison e2e) | `stage3` |
| Event operations: field reports, AI action items to tasks, risk log (Workflow E) | VERIFIED locally (22 pgTAP + operations e2e, mock AI) | `stage3`; photos and handover checklist next |
| BOQ checker (rule-based, Workflow B) | VERIFIED locally (110 unit + boq-check e2e) | `stage3`; no schema change |
| Public marketing site | VERIFIED (smoke 1: loads) | |

## Environments

| Environment | Purpose | Notes |
|---|---|---|
| Production | Supabase project `bbuqakqjmuzxpbwxflhx` + Netlify | No new testing or seeding here (TD-01) |
| Local | Supabase CLI in Docker | Development, seed fixtures, all automated tests |

## Open owner decisions
See [BLOCKERS.md](BLOCKERS.md). The most important are cleanup approval (B-01), the admin password change (B-02)
and making the repository private (B-03).
