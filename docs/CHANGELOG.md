# Changelog

All notable changes. Dates are UTC.

## Unreleased: Phase 2, Stage 1 (security and data hygiene)

### Added
- Local Supabase development stack. The CLI is pinned as a dev dependency, configured in `supabase/config.toml`, and all ten migrations apply cleanly with `npx supabase db reset`.
- Production cleanup toolkit in `docs/cleanup/`: plan, single-transaction cleanup script, ID-based restore script. Both scripts were dry-run tested on a local mirror.
- Project tracking docs: `PROJECT_STATUS`, `DEVELOPMENT_TASKS`, `TECHNICAL_DECISIONS`, `BLOCKERS`, `TESTING_REPORT`, `SECURITY_REPORT`, `CHANGELOG`.

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
