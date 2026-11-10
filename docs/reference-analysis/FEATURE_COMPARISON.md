# Feature comparison: reference workflows vs. OnGoing

Compared against the code on branch `stage3` (2026-11-10), not against earlier audits. "Reference" column:
D = demonstrated in an illustrative demo, I = inferred from copy (see [REFERENCE_SITE_AUDIT.md](REFERENCE_SITE_AUDIT.md)).
Priority: P1 (next), P2 (soon), P3 (later). Complexity: S / M / L as defined in the audit.

Classification: **IMPLEMENTED** · **PARTIAL** · **MISSING** · **NOT RELEVANT** · **RESEARCH** (requires further research).

## Status updates since the first comparison

| Date | Capability | Was | Now | Evidence |
|---|---|---|---|---|
| 2026-11-10 | Source traceability, findings with human approval, document intelligence (shared) | MISSING / PARTIAL | IMPLEMENTED | `ai_findings` table and guard, `src/lib/doc-intel`, findings panel; pgTAP 32 |
| 2026-11-10 | A: requirement and deadline extraction, mandatory document checklist, requirements register, missing-document detection, contradiction detection, clarification drafts, source references, human approval | MISSING / PARTIAL | IMPLEMENTED (increment 1) | Requirements tab; e2e `requirements.spec.ts` |
| 2026-11-10 | A: compliance matrix; link to Proposal Builder | PARTIAL | PARTIAL (register compliance % done; proposal section next) | — |
| 2026-11-10 | A: document classification, addendum comparison | MISSING | MISSING (next increments) | — |

## A. Tender and RFP intelligence

| Capability | Reference | Existing OnGoing (evidence in code) | Gap | Class | Pri | Cx |
|---|---|---|---|---|---|---|
| Tender document upload | D | RFP import uploads one PDF to the temporary `rfp-uploads` bucket and deletes it after reading (`src/app/projects/actions.ts` `extractRfp`); Documents module stores files per project (`src/app/documents`) | Tender files are not kept or linked to findings; one file at a time | PARTIAL | P1 | S |
| Document classification | D | None | Classify pack files (ITT, specs, drawings, BOQ, addendum, form) | MISSING | P2 | M |
| Requirement extraction | D | Extracts scope, deliverables, evaluation criteria, submission method/location (`src/lib/rfp.ts`) | No mandatory documents, bonds, insurances, site visits, eligibility | PARTIAL | P1 | M |
| Submission deadline extraction | D | `deadline` kept as free text; Gregorian dates only, Hijri left empty | Structured deadline date/time, other key dates, Hijri | PARTIAL | P1 | S |
| Mandatory document checklist / requirements register | D | None (Evaluation tab tracks scoring criteria with met + evidence: `evaluation_criteria`) | Register with category, owner, due date, status, linked document | MISSING | P1 | M |
| Compliance matrix | D | Evaluation criteria checklist; proposal template heading only | Requirement-by-requirement compliance status that feeds the proposal | PARTIAL | P1 | M |
| Missing-document detection | D | None | Flag requirements without a supporting document | MISSING | P1 | S (after register) |
| Contradiction detection | D | None | AI flags conflicting clauses/dates/quantities with both sources | MISSING | P2 | M |
| Addendum comparison | D | None | Compare addendum with the original and update the register | MISSING | P2 | M |
| RFI / clarification drafts | D | None | Draft questions from gaps and conflicts, approved before sending | MISSING | P2 | S |
| Source references | D | None (extraction returns values without pages) | Page number and excerpt per finding, verified against the text | MISSING | P1 | M |
| Human approval | D | The extracted blueprint is shown for review and editing before the project is created | Per-finding accept/reject with reviewer and time | PARTIAL | P1 | S |
| Link to Proposal Builder and planning | D | Blueprint creates plan phases, team roles, BOQ, evaluation criteria; proposals take a free-text brief | Requirements feed the proposal's compliance section and the calendar | PARTIAL | P2 | S |

## B. BOQ intelligence

| Capability | Reference | Existing OnGoing | Gap | Class | Pri | Cx |
|---|---|---|---|---|---|---|
| PDF ingestion / line extraction | D | BOQ lines (description, unit, quantity) extracted as part of the RFP blueprint | Dedicated BOQ extraction with client item references and pages | PARTIAL | P2 | M |
| Excel ingestion | D | None | Import xlsx/csv with column mapping | MISSING | P2 | M (needs a spreadsheet parser) |
| Quantity and unit validation | D | Database checks only that prices are not negative | Missing/zero quantities, unknown units, unit conflicts | MISSING | **P1** | S |
| Duplicate detection | D | None | Same description (normalised) repeated | MISSING | **P1** | S |
| Conflicting quantities or descriptions | D | None | Same item with different units or quantities | MISSING | **P1** | S |
| Missing specification flags | D | None | Lines without description detail / spec reference | MISSING | P2 | S |
| Categorisation and suggested procurement categories | D | Suppliers and RFQs have a free-text category; proposal items have a category; BOQ lines none | Suggest a category per line (rule-based first) | MISSING | P1 | S |
| Version comparison | D | None | Compare two BOQ versions (added, removed, changed lines) | MISSING | P2 | M |
| Source-linked findings | D | None | Findings keep document and page | MISSING | P2 | via shared infra |
| Human verification of AI quantities | D | Blueprint reviewed before saving; no per-line verification afterwards | AI lines marked unverified until a person confirms | PARTIAL | P2 | S |

## C. Estimating and pricing

| Capability | Reference | Existing OnGoing | Gap | Class | Pri | Cx |
|---|---|---|---|---|---|---|
| Historical unit-price lookup | D | None (inventory has finance-only rates for stock items) | Rate history from accepted quotes and past proposal lines | MISSING | P2 | M |
| Comparison with approved rates | D | None | Flag prices outside the usual range | MISSING | P2 | S (after history) |
| Cost breakdown | D | Proposal lines: finance-only unit cost and selling price (`proposal_item_costs`) | Components (material, labour, equipment, overheads) | PARTIAL | P3 | M |
| Selling price, markup and margin | D | Margin and margin % shown to finance users (`src/lib/money.ts`) | Price from cost + markup; markup vs margin view | PARTIAL | P2 | S |
| Pricing anomaly detection | D | None | Price below cost, zero price, margin outliers (finance only) | MISSING | **P1** | S |
| Cost variance / budget impact | I | Finance report: budget, invoiced, paid, expenses, margin per project (`report_project_finance`) | Variance against the priced BOQ and approved budget | PARTIAL | P2 | S |
| Configurable tax and currency | I | Organisation currency; organisation default VAT (settings); VAT per proposal | New proposals do not take the organisation's default VAT yet | PARTIAL | P1 | S |
| Database-level financial permissions | Stated | Finance-only tables and policies (RBAC migration; pgTAP) | — | IMPLEMENTED | — | — |

## D. Procurement coordination

| Capability | Reference | Existing OnGoing | Gap | Class | Pri | Cx |
|---|---|---|---|---|---|---|
| Quote document ingestion | D | None (amount and notes typed by hand) | Extract quote fields from an uploaded file into proposed values | MISSING | P2 | M |
| Item-to-quotation matching | D | One amount per quote per RFQ | Line items per quote mapped to RFQ/BOQ lines | MISSING | P3 | L |
| Price comparison | D | Quotes listed per RFQ, sorted by amount, finance only (`procurement-board.tsx`) | Side-by-side statement with lowest marked | PARTIAL | **P1** | S |
| Specification compliance / exclusions | D | Free-text notes | Scope basis, exclusions, deviations per quote | MISSING | **P1** | S |
| Lead-time and validity comparison | D | None | Lead time vs event date; validity vs award date | MISSING | **P1** | S |
| Missing quotation information | D | None | Flag quotes without validity, lead time, terms | MISSING | **P1** | S |
| Recommendation with reasoning | D | None | Facts-based recommendation, labelled; AI wording optional | MISSING | P2 | S |
| Approval workflow (no auto-award) | D | Quote status accepted/rejected; RFQ status awarded (manual) | Award records who, when and why; never automatic | PARTIAL | **P1** | S |
| Procurement status tracking | D | RFQ status draft/sent/awarded/closed | Purchase order and delivery tracking | PARTIAL | P3 | M |

## E. Event project operations (adapted from construction site operations)

| Capability | Reference | Existing OnGoing | Gap | Class | Pri | Cx |
|---|---|---|---|---|---|---|
| Site visit / venue inspection reports | D | Venue maps with comments and 360° panoramas (`src/components/editor`) | Structured report with photos and findings | MISSING | P2 | M |
| Production updates / daily progress reports | D | Activity log per project | Daily report (progress, crew, issues, next steps) | MISSING | P2 | M |
| Meeting minutes | I | None | Minutes with decisions and actions | MISSING | P2 | S |
| Issues and risk log | D | Tasks can be "blocked" | Issue/risk register with owner, impact, mitigation | MISSING | P2 | S |
| Action item extraction and assignment suggestions | D | Tasks with assignee and due date | AI proposes actions from notes; approved ones become tasks | MISSING | P2 | M |
| Milestone tracking | D | Milestones linked to tasks; shown in calendar and delivery report | — | IMPLEMENTED | — | — |
| Handover / handback reporting | I | None | Venue handover checklist and report | MISSING | P3 | M |
| Wayfinding installation and inspection | — | Layout editor with CAD blocks (`src/app/projects/[projectId]/layouts`) | Installation status per placed sign, inspection notes | PARTIAL | P3 | M |

## F. Management intelligence

| Capability | Reference | Existing OnGoing | Gap | Class | Pri | Cx |
|---|---|---|---|---|---|---|
| Project status overview | D | Reports: pipeline and delivery sections (`src/app/reports`) | — | IMPLEMENTED | — | — |
| Proposal pipeline | D | Reports proposals funnel and win rate; proposals dashboard | — | IMPLEMENTED | — | — |
| Overdue tasks | D | Delivery report (local-date overdue), calendar | — | IMPLEMENTED | — | — |
| Budget vs actual | I | Finance report (budget, invoiced, paid, expenses, margin) | Against priced BOQ / approved budget | PARTIAL | P2 | S |
| Procurement bottlenecks | D | Procurement report counts | RFQs past due without quotes, unawarded RFQs near the event | PARTIAL | P2 | S |
| Pending management approvals | D | None consolidated | Proposals under review, awards and AI findings awaiting decision | MISSING | P2 | S |
| Project risks and financial warnings | D | None | From the risk log and finance data (negative margin, overdue receivables) | MISSING | P2 | S |
| Weekly management summary | D | Live dashboard only | Weekly snapshot with exceptions; facts vs estimates vs AI text labelled | MISSING | P2 | M |
| Suggested management actions | D | None | Rule-based suggestions, labelled as recommendations | MISSING | P3 | S |

## Shared AI infrastructure

| Capability | Reference | Existing OnGoing | Gap | Class | Pri | Cx |
|---|---|---|---|---|---|---|
| AI provider, cost control, usage log | — | `src/lib/ai` (provider interface, limits, duplicate guard, budget, 55 s deadline) | — | IMPLEMENTED | — | — |
| Document intelligence (text by page) | D | PDF text layer read in RFP import (`unpdf`) | Page-numbered text for any stored document | PARTIAL | P1 | S |
| Source traceability | D | None | Findings keep document id, page, excerpt, verified flag, AI request id | MISSING | P1 | M |
| Findings with human approval and audit trail | D | Proposal review workflow; activity log; admin audit log | A shared findings store with accept/reject, reviewer, time | MISSING | P1 | M |
| ROI and productivity measurement | D | AI usage log | Accepted findings and estimated minutes saved, labelled as estimates | MISSING | P3 | S |
| Chat assistant in Slack/Teams | D | None | External integration | NOT RELEVANT now (later, needs an external app) | — | L |

## Not relevant to OnGoing's product
Savings calculator and outcome guarantee (marketing and commercial terms), workflow-review consulting,
lead-intake form (OnGoing's public site has its own contact path), resources blog, careers page.

## Already stronger in OnGoing
Multi-tenant permissions enforced in the database (capabilities, finance-only data, tenant-safe keys, pgTAP),
proposal review with immutable versions, venue maps and layouts, calendar, documents, reports with CSV export,
bilingual right-to-left interface, automated test suite and CI.
