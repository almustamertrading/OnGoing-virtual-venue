# Reference site audit

**Site:** https://www.monjez-agency.com/en (shared by the owner on 2026-11-10; Arabic mirror at `/ar`).
**Method:** headless Chromium through the session proxy, 2026-11-10. Every page in the site's own sitemap
was loaded at desktop (1366 px) and phone (390 px) widths; headings, links, forms, controls and text were
recorded; the public demos were operated (tabs, toggles, cards, calculator sliders). No login, no form
submission, nothing behind `robots.txt` (`/dashboard`, `/api/webhooks` are disallowed and were not visited).
Raw captures and screenshots stay outside the repository; nothing of the site's text, code or artwork is
reproduced here, only descriptions in our own words.

**What the site is.** A services company that builds custom AI workflows for fit-out and construction
contractors in the Gulf. It is not a self-serve SaaS: there is no sign-up, no pricing table, no trial and no
public product interface. Its "features" are proposed workflows shown with scripted, clearly labelled
illustrative demos; the delivered system lives behind a consulting engagement and a client dashboard.

**Evidence labels used below**
- **Confirmed (observed):** seen and operated on the public site (the page element itself works as described).
- **Inferred (marketing):** described in the site's copy or in an illustrative demo; the underlying system was
  not observable.
- **Unverifiable:** would need a client account or an engagement.

## Pages explored

| Page | URL | Content |
|---|---|---|
| Home | /en | Value proposition, six-workflow explorer, savings calculator, system diagram, trust principles, regional fit, client video, guarantee, FAQ, intake form |
| System | /en/system | Connected-workflow explainer, per-workflow before/after, scripted chat-assistant demo, the same workflow explorer |
| Workflow Review | /en/review | The consulting engagement: analysis scope, value model, four agent opportunities, deliverables, phased rollout, cost model, guarantee terms |
| Resources | /en/resources | Six articles (quote comparison, weekly site reports, BOQ re-keying, AI takeoff evidence, one client case, one client story) |
| Join | /en/join | Careers placeholder (no open roles) |
| Arabic mirror | /ar, /ar/* | Same structure, right-to-left, Gulf-dialect copy, same calculator and form |
| Related domains in the company sitemap | monjez.ai, monjez.com | A separate CRM / marketing product for small businesses (features such as CRM, appointments, WhatsApp inbox, payments and invoices). Out of scope; noted only because it shares the sitemap |

Mobile: no page scrolled sideways at 390 px (checked on all 11 English pages).

## Features

Complexity is the estimate for building the capability **inside OnGoing**: S (days), M (one to two weeks), L (several weeks or external dependencies).

### R-01 Tender requirements register
- **Business purpose:** never miss a submission requirement, bond, insurance, site visit or deadline in a tender.
- **Workflow:** the tender pack arrives; documents are classified; dates and submission requirements are extracted into a register, each line referenced to its source page; missing documents and conflicting clauses are flagged; a bid/tender manager reviews and approves; go/no-go and all client clarifications stay with people.
- **Inputs → outputs:** ITT/RFP, specifications, drawing lists, addenda, the company's checklist template → requirements register, deadline summary, draft clarification (RFI) list, flags (spec vs BOQ conflicts, referenced-but-missing documents, unclear requirements).
- **Data entities:** tender, document, requirement (category, source reference, status, owner, due date), clarification question.
- **Dependencies:** document ingestion, AI extraction, approval step.
- **Complexity:** M.
- **Evidence:** /en (Workflow 1, both views, operated); /en/system (tender review tab, scripted chat demo). **Inferred (marketing)**; the delivered system is **unverifiable**.

### R-02 Tender summary and go/no-go support
- **Purpose:** a one-screen summary per tender on day one, so a manager decides go/no-go with the facts.
- **Workflow:** someone asks for a summary; the system returns submission date, scope, missing items, site visit, with source citations, and proposes a next action (draft an RFI).
- **Inputs → outputs:** tender pack → summary card with sources, suggested next action.
- **Entities:** tender, summary, decision.
- **Dependencies:** R-01.
- **Complexity:** S–M.
- **Evidence:** /en/system (scripted chat demo, labelled illustrative). **Inferred**.

### R-03 BOQ extraction and normalisation
- **Purpose:** stop estimators re-typing client BOQs; keep the client's item references.
- **Workflow:** a PDF or Excel BOQ is extracted into the company's own structure; units and descriptions are normalised to company rules; items are cross-checked against specification and drawing references.
- **Inputs → outputs:** BOQ (PDF/Excel), specification sections, company item codes → structured BOQ, exceptions report, questions for the consultant.
- **Entities:** BOQ line (client reference, description, unit, quantity, kind: measured / provisional sum / prime cost).
- **Dependencies:** document ingestion, AI extraction.
- **Complexity:** M (PDF), S (Excel).
- **Evidence:** /en (Workflow 2, operated); /en/review (BOQ structuring agent); /en/resources/boq-rekeying-estimators (where errors come in). **Inferred**.

### R-04 BOQ checks (exceptions before pricing)
- **Purpose:** catch errors before anyone prices a line.
- **Workflow:** after structuring, the system flags missing quantities, possible duplicates, unit or description mismatches and provisional sums; the quantity surveyor reviews; quantities are never silently changed.
- **Inputs → outputs:** structured BOQ → exceptions list per line.
- **Entities:** BOQ line, check result.
- **Dependencies:** structured BOQ data.
- **Complexity:** S (rule-based).
- **Evidence:** /en (Workflow 2 "with" view lists the flags, operated). **Inferred** (the checks themselves were not observable).

### R-05 Rate matching with a source trail
- **Purpose:** consistent pricing; every rate traceable; no invented rates.
- **Workflow:** BOQ lines are matched to the approved rate library and, where data exists, to past rates; a draft build-up (material, labour, plant, overheads) is prepared; lines without an approved rate and rates outside the usual range are flagged; the commercial manager approves price, margin and risk.
- **Inputs → outputs:** structured BOQ, rate library, supplier quotes, past priced projects, margin/risk rules → draft costing sheet, rate source trail, pricing scenarios, flags.
- **Entities:** rate (item, unit, cost, source, date), build-up components, scenario.
- **Dependencies:** R-03, historical data.
- **Complexity:** M–L.
- **Evidence:** /en (Workflow 3, operated). **Inferred**.

### R-06 Supplier quote comparison (like-for-like)
- **Purpose:** stop the cheapest quote turning expensive because of hidden exclusions, expired validity or long lead times.
- **Workflow:** each quotation (PDF, Excel, email, even voice notes) is extracted into one format; a comparative statement is built; spec deviations, exclusions, lead times and payment terms are flagged; clarification questions and reminders are drafted for approval; the procurement manager selects; orders follow approval rules.
- **Inputs → outputs:** RFQ and schedule, supplier quotations, approved vendor list → comparative statement, deviations and exclusions list, follow-up tracker.
- **Entities:** RFQ, quote (price, scope basis, exclusions, validity, lead time, payment terms, alternates), follow-up.
- **Dependencies:** quote capture (manual or AI), approval.
- **Complexity:** S (manual capture + comparison), M (AI extraction from files).
- **Evidence:** /en (Workflow 4, operated); /en/review (quote comparison agent); /en/resources/supplier-quote-comparison-mistakes (comparison practices). **Inferred**.

### R-07 Daily site report from field updates
- **Purpose:** turn scattered photos, voice notes and messages into a structured daily report.
- **Workflow:** site notes become a daily report; RFI, submittal and action registers are kept current; owners of overdue items are reminded; exceptions go to the project manager; progress figures count only after the PM confirms.
- **Inputs → outputs:** site reports, voice notes, photos, RFI/submittal logs, programme → daily site report, RFI and action tracker, overdue alerts.
- **Entities:** daily report, update, RFI, submittal, action, owner.
- **Dependencies:** media upload, AI summarisation, notifications.
- **Complexity:** M (text + photos), L (voice / WhatsApp intake).
- **Evidence:** /en (Workflow 5, operated); /en/review (progress report agent); /en/resources/reliable-weekly-site-report (report structure). **Inferred**.

### R-08 RFI, submittal and action registers
- **Purpose:** one current list of questions, submittals and actions, each with an owner and a date.
- **Workflow / I-O:** part of R-07; overdue items are surfaced to owners.
- **Entities:** RFI (question, to whom, sent, due, answer), submittal, action.
- **Dependencies:** notifications for reminders.
- **Complexity:** S–M.
- **Evidence:** /en (Workflow 5). **Inferred**.

### R-09 Weekly management report
- **Purpose:** the owner stops chasing five people for the same numbers.
- **Workflow:** agreed figures are pulled from connected sources; tender pipeline, project status and procurement are consolidated; one weekly report highlights exceptions; each figure shows its source; the owner or GM approves.
- **Inputs → outputs:** tender log, project trackers, procurement and finance exports → weekly report, pipeline and win/loss view, exceptions list (unsourced figures, items behind programme, decisions waiting).
- **Entities:** KPI, report snapshot, exception.
- **Dependencies:** data from the other workflows; scheduling; email.
- **Complexity:** S (in-app snapshot), M (scheduled email).
- **Evidence:** /en (Workflow 6, operated); /en/resources/reliable-weekly-site-report. **Inferred**.

### R-10 Human approval on every AI output
- **Purpose:** AI drafts, people decide; nothing leaves the company without approval.
- **Workflow:** each workflow names its approver (bid manager, QS, commercial manager, procurement manager, PM, owner).
- **Entities:** approval rule, approver role.
- **Dependencies:** roles and permissions.
- **Complexity:** S per workflow (pattern).
- **Evidence:** /en (agent cards and every workflow panel name the approver, operated; trust principles section). **Confirmed as a stated principle; inferred as behaviour**.

### R-11 Traceable outputs and surfaced exceptions
- **Purpose:** every number points to its source; exceptions are shown rather than silently fixed.
- **Evidence:** /en (trust principles: traceable outputs, exceptions surfaced, approval rules, existing tools first, data controls agreed upfront). **Inferred**.
- **Complexity:** S–M (store source references with AI-extracted items).

### R-12 Chat assistant inside the team's messaging tool
- **Purpose:** people ask for summaries and actions from Slack.
- **Workflow:** a manager mentions the assistant in a channel; it answers with a sourced summary and proposes a next step.
- **Dependencies:** Slack app, permissions, AI.
- **Complexity:** L (external integration).
- **Evidence:** /en/system (scripted, labelled "not a live workspace"). **Inferred**; live behaviour **unverifiable**.

### R-13 Savings calculator
- **Purpose:** show the value of automating document work.
- **Workflow:** four sliders (tenders per month 1–40, document hours per tender 2–60, share assisted 10–70 %, hourly cost USD 8–80); output = hours released per month and labour value per year, with the formula and disclaimers shown.
- **Evidence:** /en, operated: defaults 8 / 16 / 40 % / 25 → 51 hours a month, USD 15,360 a year; 20 / 30 / 50 % / 40 → 300 hours, USD 144,000 (formula tenders × hours × share × 12 × rate). **Confirmed (observed)**.
- **Complexity:** S. Marketing tool, not a product feature.

### R-14 Workflow review (consulting engagement) and value model
- **Purpose:** measure hours before building; produce process maps, a value model (net hours released × agreed hourly cost × working weeks), an AI opportunity matrix, a data and integration assessment, and a fixed scope for the first agent; phased rollout (first agent, connected workflows, "AI department").
- **Evidence:** /en/review. No fee for qualifying firms; implementation fixed-price after the review; monthly support separate. **Confirmed as published terms**; the service itself is **unverifiable**.

### R-15 Outcome guarantee
- **Purpose:** risk reversal: the client does not pay if an agreed annual capacity value is not validated.
- **Evidence:** /en, /en/review. **Confirmed as a published claim**. Commercial, not a product feature.

### R-16 Lead intake and qualification form
- **Purpose:** qualify leads (role, country, company type and size, main bottleneck).
- **Evidence:** /en, form fields recorded (all required; phone defaults to +971). Not submitted. **Confirmed (observed)**.

### R-17 Resources hub
- **Purpose:** educational articles that explain the problem space (quote comparison, site reports, BOQ re-keying, AI takeoff limits).
- **Evidence:** /en/resources and six articles. **Confirmed (observed)**.

### R-18 Bilingual Arabic / English with right-to-left layout
- **Evidence:** /ar (lang `ar`, `dir="rtl"`, same components). **Confirmed (observed)**.

### R-19 Integrations
- **Purpose:** work with existing tools (Excel, Google Sheets, email, shared drives, ERP, WhatsApp, Slack).
- **Evidence:** home and system copy; no integration catalogue or API documentation. **Inferred**; specifics **require further research**.

### R-20 Client dashboard
- **Evidence:** `robots.txt` disallows `/dashboard`. **Unverifiable** (requires an account; not visited).

## Not found on the site
Pricing tiers or subscriptions, self-serve sign-up, project or task management, client or supplier records,
invoicing, calendars, document management, permissions screens, mobile apps. These either do not exist publicly
or sit inside the unverifiable client system.

## The six workflows in detail

Status key: **Demonstrated** = shown in an interactive demo that we operated (the demo uses illustrative,
scripted data; the site says so); **Inferred** = described in copy only; **Verified** = working production
behaviour we could observe. No workflow is **Verified**: the delivered systems are behind client engagements.
Source for all six: /en "operating system" explorer (each workflow in both "today" and "with the system"
views, operated 2026-11-10), /en/system, /en/review (agent opportunities).

| | 1 Tender management | 2 BOQ analysis | 3 Estimating & pricing |
|---|---|---|---|
| Business objective | Never miss a requirement, bond, insurance, site visit or deadline; decide go/no-go on facts | A clean, checked BOQ before anyone prices | Draft rate build-ups with a source behind every rate |
| Inputs | ITT/RFP and instructions, specifications, drawing lists, addenda, company checklist template | BOQ (PDF or Excel), specification sections, company item codes and naming rules | Structured BOQ, rate library, supplier quotes, past priced projects, margin and risk rules |
| Processing | Classify and index every document; extract dates, site visits, bonds, insurances, submission rules; draft a register with page references; flag missing documents and conflicting clauses | Extract lines into a structured sheet; normalise units and descriptions; flag missing quantities, duplicates, provisional sums; cross-check against spec and drawing references | Match lines to the approved rate library; compare with past rates where data exists; draft build-up (material, labour, plant, overheads); show each rate's source |
| AI responsibilities | Reading, extraction, register drafting, conflict and gap detection, RFI drafting | Extraction, normalisation, exception detection | Matching, comparison, draft build-up, range checks |
| Data entities | Tender, document, requirement, deadline, clarification (RFI) | BOQ line (client ref, unit, quantity, kind), exception, consultant question | Rate (item, unit, cost, source, date), build-up component, pricing scenario |
| Outputs | Requirements register, deadline summary, draft RFI list | Structured BOQ, exceptions report, questions for the consultant | Draft costing sheet, rate source trail, pricing scenarios |
| Human approval | Bid / tender manager; go/no-go and client clarifications stay with people | Quantity surveyor / estimator; quantities never silently "fixed" | Estimation / commercial manager; no missing rate invented; price, margin, risk stay with people |
| Exceptions | Spec vs BOQ conflicts; referenced-but-missing documents; unclear submission rules | Missing quantities, possible duplicates, unit/description mismatches, provisional sums | Lines with no approved rate, rates outside the usual range, price-affecting assumptions |
| Integration | Feeds BOQ analysis and the weekly report | Checked BOQ moves to estimating | Costing feeds procurement and the proposal |
| Status | Demonstrated | Demonstrated | Demonstrated |

| | 4 Procurement coordination | 5 Project operations | 6 Management reporting |
|---|---|---|---|
| Business objective | Like-for-like supplier comparisons without copy-paste | Site updates, RFIs and actions in one place | The weekly picture the owner keeps asking for |
| Inputs | RFQs and material schedules, supplier quotes (PDF, Excel, email), approved vendor list | Site reports, voice notes, photos, RFI and submittal logs, programme milestones | Tender log, project trackers, procurement and finance exports (read access), the KPIs the owner manages by |
| Processing | Extract each quote into one format; build a comparative statement; flag spec deviations, exclusions, lead times, payment terms; draft clarifications and reminders | Turn notes and photos into daily reports; keep RFI, submittal and action registers current; remind owners of overdue items; route exceptions to the PM | Pull agreed figures from connected sources; consolidate pipeline, project status, procurement; one weekly report that highlights exceptions; each figure shows its source |
| AI responsibilities | Extraction, normalisation, comparison, drafting follow-ups | Summarisation, register upkeep, reminder drafting | Consolidation, exception detection, narrative |
| Data entities | RFQ, quote (price, scope basis, exclusions, validity, lead time, payment terms, alternates), follow-up | Daily report, update, photo, RFI, submittal, action (owner, due) | KPI, report snapshot, exception, decision |
| Outputs | Comparative statement, deviations and exclusions list, follow-up tracker | Daily site report, RFI and action tracker, overdue alerts | Weekly management report, pipeline and win/loss view, exceptions list |
| Human approval | Procurement manager; supplier selection, orders and anything sent outside follow approval rules | Project manager; progress figures from notes count only once confirmed | Owner / general manager; reports show their sources and are only as current as their inputs |
| Exceptions | Spec deviations and alternate brands, exclusions and conditions, lead times beyond the programme | Overdue RFIs and submittals, unconfirmed progress, actions without an owner | Figures that could not be sourced, items behind programme, decisions waiting on management |
| Integration | Orders and deliveries tracked in project operations | Confirmed updates feed management reporting | Decisions flow back to tender and project teams |
| Status | Demonstrated | Demonstrated | Demonstrated |

## Cross-cutting capabilities

| Capability | What the site shows | Status |
|---|---|---|
| Source-linked findings | Register lines "referenced to the source page"; chat summary cites "ITT section 2.3"; reports show each figure's source | Demonstrated / inferred |
| Requirements registers and compliance checks | Workflow 1 register, missing-document and unclear-requirement flags | Demonstrated |
| Cost estimation and historical rates | Workflow 3; historical comparison "depends on your data" | Demonstrated, conditional |
| Supplier quote comparison | Workflow 4; article on like-for-like practices (scope basis, exclusions log, validity, units, lead and payment terms, allowances for exclusions) | Demonstrated |
| AI agent coordination | Agents share one company knowledge base; each hands its output to the next workflow ("next step" links) | Inferred |
| Human approval systems | A named approver per workflow; nothing external without approval | Stated principle |
| Operational dashboards | Weekly owner report; client dashboard behind login | Inferred / unverifiable |
| Workflow audit trails | "Every number traceable"; approvals recorded | Inferred |
| ROI and productivity measurement | Calculator (operated), value model (net hours × agreed rate × weeks), hours released per agent | Calculator confirmed; value model published as method |
