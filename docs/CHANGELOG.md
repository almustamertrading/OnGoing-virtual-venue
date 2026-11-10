# Changelog

All notable changes. Dates are UTC.

## Unreleased (development branch `stage3`): Phase 2, Stages 3–4

### Added
- Settings & Administration: organisation settings (time zone, VAT, contact details), email domains for
  automatic membership, admin audit log, account security (password change, reset, sign out other devices).
- Global calendar (month, week, agenda) across projects, milestones, tasks, proposals, RFQs and invoices.
- Central documents with project and organisation scope, confidential files, versions and signed downloads.
- Reports & analytics: pipeline, proposals, delivery, procurement and finance (finance-only), CSV export.
- AI cost control: provider interface (Anthropic + mock), usage log, per-user limits, duplicate guard,
  organisation monthly token budget (TD-07).
- Proposal Builder Phase 2: templates, template-guided AI drafts, internal review with comments, change
  requests and approval, locked approved content, version history with a view and PDF of every version,
  atomic conversion to a project (TD-08).

- AI operations workflows on one shared findings layer (TD-10): every AI result is a finding with its source
  (document and page, or the report text), a check that the quoted excerpt really is in the source, and a
  recorded human decision.
  - Tender requirements register (Workflow A): AI reads a tender PDF page by page; accepted findings become
    register rows with owner, due date, status and evidence; compliance summary; due dates in the calendar.
  - Supplier quote comparison (Workflow D): flags for price, validity, lead time against the event date and
    missing information; a labelled recommendation; a human award with a required reason, one per RFQ.
  - Event operations (Workflow E): field reports of eight types; AI proposes action items, issues, risks and
    decisions; accepted action items become tasks with a suggested assignee and due date; issues and risks
    go to a new risk log linked to their report.
- BOQ checker on the project Pricing tab and the proposal BOQ: missing quantities and units, unpriced lines,
  duplicates, unit and quantity conflicts, provisional sums, vague descriptions and suggested procurement
  categories; for finance users also below-cost lines and margin outliers. It only reports.

### Security
- S-13 to S-15 found and fixed before release; S-16 accepted and documented.

## Unreleased: Phase 2, Stage 1 (security and data hygiene)

### Added
- Local Supabase development stack. The CLI is pinned as a dev dependency, configured in `supabase/config.toml`, and all ten migrations apply cleanly with `npx supabase db reset`.
- Production cleanup toolkit in `docs/cleanup/`: plan, single-transaction cleanup script, ID-based restore script. Both scripts were dry-run tested on a local mirror.
- Project tracking docs: `PROJECT_STATUS`, `DEVELOPMENT_TASKS`, `TECHNICAL_DECISIONS`, `BLOCKERS`, `TESTING_REPORT`, `SECURITY_REPORT`, `CHANGELOG`.

- Database migrations (local, not yet in production):
  - `20261109160000` hygiene: FK indexes, per-command policies, tenant-safe composite foreign keys.
  - `20261109170000` capability RBAC with finance-only invoices, expenses, quotes, costs and inventory valuation.
- Members & Permissions page (`/settings/members`) for organisation admins.
- Test engine:
  - Vitest unit tests (20);
  - pgTAP database tests (53);
  - migration data-move check;
  - Playwright smoke suite (20) against a local stack with seeded QA users;
  - GitHub Actions CI gate.
- Shared money helpers (`src/lib/money.ts`) replace five copies of the BOQ and proposal total logic.

### Fixed
- The project Overview read the current date during prerender. Outsiders saw an endless "Loading…" instead of "not found".
- The server Supabase client ran during partial prefetch, which logged "unstable Date.now()" errors on several routes.
- ESLint reported 1,103 warnings from the vendored MapLibre worker; only that generated file is now ignored.

### Security (production, no data removed)
- Full snapshot of all application data in schema `ops_backup_20261109`.
- Banned the three QA accounts with known passwords and revoked their sessions.

## 2026-11-09: Proposal Builder (Phase 1)
- Organisation-level proposals: six types, eleven-step status lifecycle, `ONG-PRO-YYYY-NNNN` references, template sections, AI draft with guardrails, financial BOQ with internal cost and margin, client-facing print/PDF view, conversion to a project.

## 2026-11-07: Business/Ops and Procurement
- Finance tab (invoices and expenses against the budget), organisation inventory register.
- Procurement (Planner): supplier directory, RFQs, quotes and awards.

## 2026-11-05: Layout editor and RFP blueprint
- AutoCAD-style 2D block library, GoodEvent-grade layout editor (seating generators, templates, scale calibration, real-time co-editing).
- RFP import extracts the full blueprint (client contact, BOQ to pricing, timeline to plan, team structure, evaluation criteria as mandatory KPIs, submission details). Uploads go directly to Storage, avoiding the 1 MB Server Action limit.

## 2026-11-04: Platform foundation
- Projects workspace (scope, milestones, tasks, team, activity log), venues map editor with layers, comments and 360° panoramas, organisations with email-domain membership, public marketing site.
