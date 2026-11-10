# Implementation roadmap: AI operations workflows for OnGoing

Goal: six AI-assisted workflows for event companies, built **inside** the existing modules on **one shared
AI layer**, not six separate tools. Principles carried into every milestone:
- **AI proposes, people decide.** Every AI output is a *finding* with status `proposed` until a person with the
  right permission accepts or rejects it. Nothing is awarded, sent or committed automatically.
- **Source traceability.** Every document-derived finding keeps the document, page, a short excerpt and whether
  that excerpt was found on that page; plus the AI request that produced it (provider, model, tokens, time).
- **No invented numbers.** Prices, quantities and KPIs come from structured data; when data is missing the item
  is flagged for human input. Reports label facts, estimates and AI recommendations differently.
- **Existing security model.** Database RLS and capabilities; finance-sensitive findings are finance-only.
- **Small, independently testable milestones**, each with unit, database (pgTAP) and end-to-end tests,
  verified in the running app before it is marked done. Local only; production changes need approval.

Parallel work: independent milestones may run in separate worktrees with clear file ownership. The main agent
is the single owner of migrations, shared types and docs.

## Shared AI infrastructure (foundation for A, B, D, E)

### S-1 Document intelligence and source-traceable findings
- **User story:** as a bid or project manager, I want AI results to show exactly where in which document they
  came from, and to accept or reject each one, so I can trust and audit them.
- **Acceptance criteria:** text is read per page from any PDF in Documents; each finding stores document id,
  page, excerpt, `source_verified` (excerpt found on that page), AI request id, workflow, kind, severity,
  structured payload; findings start `proposed`; accept/reject records reviewer, time and note through a
  trigger (not client-supplied); provenance fields cannot be edited after creation; finance-sensitive findings
  are readable only with project finance access; every AI call goes through the existing cost-controlled runner.
- **UI:** a reusable findings panel: grouped by kind, severity chips, source line (document, page, excerpt,
  verified badge, open document), accept / reject with note, empty and loading states.
- **Backend:** `src/lib/doc-intel/` (page text, paged prompt with page markers, excerpt verification,
  structured-output schema), server actions for accept/reject.
- **Database:** `ai_findings` (+ RLS, guard trigger, indexes); `ai_usage_logs.feature` gains new features.
- **Permissions:** create and review with project edit rights (or organisation contribution rights for
  organisation-level findings); finance findings need finance access.
- **Integration points:** Documents (source files), AI runner (usage log), activity log.
- **Tests:** pgTAP (RLS, immutability, reviewer stamping, finance gating), unit (page parsing, excerpt
  verification, schema parsing), e2e via the first workflow (A).
- **Complexity:** M. **Dependencies:** Documents module, AI runner.

## Workflow milestones

### M1 BOQ checker (Workflow B, rule-based) — verified 2026-11-10
- **Story:** as an estimator, I want obvious BOQ problems flagged before pricing.
- **Acceptance:** flags missing quantities, unpriced lines, missing/unknown units, duplicates, unit and quantity
  conflicts, provisional sums, vague descriptions; finance users also see below-cost and margin outliers;
  suggested procurement category per line; links to the row; nothing changed automatically.
- **UI:** panel on the project Pricing tab and the proposal BOQ. **Backend:** pure module. **DB:** none.
- **Permissions:** cost checks only where costs are already sent (finance users).
- **Tests:** unit for every rule and the Arabic normalisation; e2e for sales, finance, non-finance, 375 px.
- **Complexity:** S. **Dependencies:** none.

### M2 Tender intelligence and requirements register (Workflow A)
- **Story:** as a bid manager, I want the tender documents read for requirements, deadlines, mandatory
  documents, conflicts and questions, with sources, so I can build a complete compliance register and never
  miss a submission item.
- **Acceptance:** run analysis on a project's tender document; findings for requirements (category: document,
  certificate, bond, insurance, form, site visit, deadline, eligibility, technical, other), key dates,
  conflicting clauses and clarification questions, each with page and excerpt; accepting a requirement creates
  a register row; register rows have owner, due date, status (open, in progress, met, not applicable) and a
  supporting document; requirements without a supporting document are shown as missing; due dates appear in the
  calendar; compliance percentage shown; clarification drafts can be copied (never sent automatically).
- **UI:** new project tab "متطلبات العطاء" (register + findings panel + run analysis on a chosen document).
- **Backend:** tender analysis prompt and schema on S-1; accept handlers; calendar feed branch.
- **DB:** `project_requirements` (+ RLS, composite keys); calendar feed function updated.
- **Permissions:** project editors manage the register; project members read it.
- **Integration:** Documents (evidence), Calendar (due dates), RFP import (same document), Proposal Builder
  (compliance section from the register, next increment).
- **Tests:** pgTAP (RLS, cross-tenant, statuses), unit (prompt and parsing, compliance maths), e2e with the
  mock AI (run analysis, sources shown, accept, register, missing-document flag, calendar entry).
- **Complexity:** M. **Dependencies:** S-1.

### M3 Supplier quote comparison and award approval (Workflow D)
- **Story:** as a procurement manager, I want quotes compared like for like (price, scope basis, exclusions,
  validity, lead time, payment terms) with gaps flagged, and the award decision recorded by a person.
- **Acceptance:** quote fields for scope basis, exclusions, validity date, lead time, payment terms; comparison
  statement per RFQ; flags: lowest price, missing information, validity expiring before award, lead time beyond
  the event start; recommendation shown as reasoning from those facts (labelled recommendation); award only by
  a person with finance access, with a reason; no automatic award. Next increment: AI extraction of these
  fields from an uploaded quote file (proposed values that a person confirms, via S-1).
- **UI:** comparison view in the Procurement tab. **DB:** columns on `quotes` (+ award stamping trigger).
- **Permissions:** finance-only (as today for quotes). **Tests:** pgTAP, unit (comparison rules), e2e.
- **Complexity:** S–M. **Dependencies:** none (S-1 for AI extraction).

### M4 Smart estimating (Workflow C)
- **Story:** as a commercial manager, I want past rates for similar items and warnings on unusual prices.
- **Acceptance:** finance-only rate history from accepted quotes and past proposal lines with their source;
  price-vs-history flags; markup and margin view; organisation default VAT applied to new proposals; items
  without reliable data are flagged, never priced by the system.
- **DB:** a finance-only security-invoker function for rate history. **Tests:** pgTAP, unit, e2e.
- **Complexity:** M. **Dependencies:** M1 (checks), M3 (quote data).

### M5 Event operations reports (Workflow E)
- **Story:** as an operations manager, I want site visits, venue inspections, production updates, daily
  reports, meeting minutes and handover notes in one place, with action items and risks extracted for approval.
- **Acceptance:** report types (site visit, inspection, production update, daily, meeting, handover, handback,
  wayfinding inspection) with notes and photos (Documents); AI proposes action items, issues and risks (S-1);
  accepted actions become tasks with an assignee suggestion; issues and risks go to a risk log (owner, impact,
  mitigation, status); milestones linked.
- **DB:** `ops_reports`, `project_risks`. **Tests:** pgTAP, unit, e2e. **Complexity:** M.
- **Dependencies:** S-1, Tasks, Documents.
- **Status (2026-11-10):** increment 1 verified (reports, AI extraction, action items to tasks, risk log).
  Next: photos from Documents on a report, link a report to a milestone, handover checklist, per-sign
  wayfinding installation status.

### M6 Management intelligence (Workflow F)
- **Story:** as an owner, I want a weekly summary of status, budget vs actual, procurement bottlenecks, overdue
  work, pending approvals, pipeline, risks and financial warnings, with suggested actions.
- **Acceptance:** every number from SQL (facts), estimates labelled, recommendations labelled; optional AI
  narrative built only from the facts payload; weekly snapshot kept; finance parts finance-only.
- **DB:** `management_reports` snapshots, report functions. **Tests:** pgTAP, unit, e2e. **Complexity:** M.
- **Dependencies:** Reports, M2–M5 for richer inputs.
- **Status (2026-11-10):** increment 1 verified: live summary from one RLS-scoped function, labels, rule-based
  suggestions, AI recommendations checked against the facts they cite, briefs private to author and admins.
  Next: stored weekly snapshots with week-over-week change, budget against the priced BOQ, email digest (P-06).

### Later
BOQ ingestion from Excel and version comparison (Workflow B, needs a spreadsheet parser decision; PDF extraction
with per-line verification was verified on 2026-11-10); addendum comparison and document classification (A); purchase orders and
deliveries (D); AI value report (hours saved, labelled estimates); chat assistant in the team's messenger
(external integration, needs a decision).

## Order
S-1 + M2 (main agent, sequential: they share the migration) ‖ M1 (parallel worktree) → M3 → M4 → M5 → M6.
