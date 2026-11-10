# Technical decisions

Short records of decisions that shape the codebase. Newest last. Each record has the context, the decision and its consequences.

## TD-01 · Local Supabase is the development and test database (2026-11-09)

**Context.** All testing and seeding so far ran against production, because no other database existed.

**Decision.** The Supabase CLI runs the full stack locally in Docker; the CLI is a pinned dev dependency.
`npx supabase db reset` rebuilds the database from `supabase/migrations/` in about a minute. All automated
tests and seed fixtures target the local stack only, and test helpers refuse to run against a non-local URL.
A hosted staging project (a Supabase branch or a second project) can be added later. It costs money and
needs the owner's approval.

**Consequences.**
- Every migration is applied locally (`db reset`) before it goes near production.
- CI runs the same stack (`supabase start`).
- Local auth has email confirmation turned off (`supabase/config.toml`), so test users can sign in at once. Production keeps confirmation on.

## TD-02 · No production business data in the repository (2026-11-09)

**Context.** The GitHub repository is public.

**Decision.** Docs, fixtures and scripts in git may contain record IDs, codes and categories, never
client names, contacts, amounts or credentials. Reports that need names go to the owner privately, outside git.
Test fixtures use synthetic data on reserved domains (`*.test`).

## TD-03 · Reversible cleanup through an in-database snapshot (2026-11-09)

**Decision.** Before any production cleanup, a schema `ops_backup_<date>` holds a full copy of every
application table, plus `auth.users` and the storage-object rows. The schema has no API grants.
- Cleanup scripts refuse to run if the snapshot is missing.
- Restore scripts insert by ID set, using the columns common to the live table and the snapshot, so they survive later schema changes.
- Both scripts were dry-run on a local mirror with the same UUIDs.

## TD-04 · Capability-based access on top of project roles (2026-11-09)

**Context.**
- Organisation roles (`admin`, `manager`, `staff`) and project roles (`owner`, `editor`, `viewer`) decide who sees which records.
- They do not separate financial data from operational data, so every member reads internal costs.

**Decision.**
- Add capabilities per organisation member: `organization_admin`, `project_manager`, `finance_access`, `sales_access`, `operations_access`, `viewer_access`. Org `admin` implies every capability.
- Enforce them in Postgres through a `private.has_capability(org, cap)` helper used in RLS policies, not only in the UI.
- Columns holding internal cost move to separate finance-only tables. RLS works per row, not per column, and a 1:1 side table is the only way to hide a column per user without breaking `select *` and Realtime.
- Move them expand/contract style: create and backfill the new table and switch the app; drop the old column only in a later migration, after verification.

**Default until the business approves a policy:** costs, margins, expenses, supplier quote amounts,
invoices and inventory valuation are visible only to admins and to users explicitly given `finance_access`.

## TD-05 · Composite foreign keys for tenant integrity (2026-11-09)

**Decision.** A child row that carries `project_id` or `organization_id` references its parent by
`(parent_id, tenant_id)`, so the database rejects links across projects or organisations.
`ON DELETE SET NULL (col)` (Postgres 15+) keeps optional links nullable without nulling the tenant column.

## TD-06 · Single migration owner (2026-11-09)

**Decision.** Only the main agent creates files in `supabase/migrations/`. Parallel workstreams receive
their tables as contracts from the migration owner. They may propose SQL but never add migration files,
which keeps the sequence linear.

## TD-07 · AI behind a provider interface, with cost controls in the database (2026-11-09)

**Context.** AI calls went straight to the vendor SDK from two features, with no usage record, no limits and
no protection against repeated or concurrent identical requests. There is no development API key (B-05).

**Decision.** `src/lib/ai/` defines a small provider interface with two implementations: Anthropic and a
deterministic mock. The mock runs only when `AI_PROVIDER=mock` is set (tests, local work); without a key the
features report "not configured" instead of silently using the mock. Every call goes through `runAi`, which
checks per-user hourly and daily limits, a duplicate window (an identical successful request within 10
minutes needs an explicit "regenerate anyway"), and the organisation's monthly token budget, then records
provider, model, feature, tokens, latency and outcome in `ai_usage_logs`. A unique partial index stops two
identical requests from running at once. Limits are environment variables (`AI_LIMIT_*`,
`AI_ORG_MONTHLY_TOKEN_LIMIT`, `AI_DUPLICATE_WINDOW_MINUTES`). The default model stays the one production
already used (`claude-sonnet-5-5`), configurable with `AI_MODEL`. Proposal drafts use structured JSON
output; RFP extraction keeps its proven parse-and-coerce path. Declined requests use the API's server-side
fallback.

**Consequences.** Usage is visible and bounded per user and per organisation. The log is written with the
user's own session, so it is trustworthy for counting requests but not tamper-proof for token totals (S-16).
Live verification with the real service waits for a development key (B-05); long generations may approach
the hosting platform's function time limit and must be checked then.

## TD-08 · The proposal workflow is enforced in the database (2026-11-09)

**Context.** Internal review must gate what reaches clients, and approved content must not change silently.

**Decision.** A trigger owns the workflow fields: approval (who and when), submission time and the version
number cannot be written directly, and new proposals start as drafts. Content (header, sections, items) is
editable only while drafting or revising; it is locked during review and after approval. Re-submitting or
reopening clears the approval. Approval happens through `proposal_reviews` (managers only; a change request
needs a reason). Submission, approval and sending each freeze an immutable snapshot in `proposal_versions`,
which never includes internal costs; versions can be viewed and printed. Conversion to a project is one
transaction (`convert_proposal_to_project`) that copies client prices only.

**Consequences.** The UI only decides which buttons to show (`src/lib/proposal-workflow.ts`); every move is
re-checked by the database. Managers keep an explicit status override.

## TD-09 · Session-reading layouts block on the server for now (2026-11-09)

**Context.** With Cache Components, a layout that reads the session cannot be part of a prerendered shell;
Next.js reports this during development on every project tab.

**Decision.** The project workspace layout sets `export const instant = false` (the documented opt-out),
keeping today's behaviour. Streaming the header behind Suspense is a Stage 5 performance item.

**Consequences.** No behaviour change; the development warning is gone, so new warnings stand out.

## TD-10 · One shared AI findings layer for every workflow (2026-11-10)

**Context.** Six AI workflows are planned (tender, BOQ, pricing, procurement, operations, management). Built
separately, each would invent its own storage, review and audit, and AI output could slip into commercial
data unreviewed.

**Decision.** Every AI result is a row in `ai_findings`: workflow, kind, severity, the proposed content, its
source (document, page, a short excerpt, and whether that excerpt was found on that page by
`src/lib/doc-intel`), and the AI request that produced it (`ai_usage_log_id`). A trigger keeps provenance
immutable, forces new rows to `proposed` and stamps the reviewer and time on accept/reject; reopening clears
the decision. Finance-sensitive findings carry `finance_only` and are readable only with project finance
access. A workflow turns an accepted finding into its own record in one transaction (first:
`accept_finding_as_requirement`), and the finding keeps a pointer to what it became. One reusable panel shows
findings, sources and decisions.

**Consequences.** New workflows add a prompt, a schema, a parser and an accept function, not a new review
system. The audit trail (what the AI said, where, which request, who decided) is uniform. Excerpt checking
makes unverifiable claims visible instead of hiding them.

## TD-11 · Operations findings become tasks and a separate risk log (2026-11-10)

**Context.** Field reports (site visits, inspections, minutes, handovers) produce three kinds of follow-up:
work someone must do, problems that exist now, and things that may go wrong. Tasks already exist with
assignees, due dates and a board; there was no place for issues and risks.

**Decision.** Accepted action items become ordinary tasks, so they appear on the task board, in the calendar
and in the delivery report without new screens. Issues and risks go to a new `project_risks` log (impact,
likelihood for risks only, mitigation, owner, status, source report), because a risk is watched and
mitigated rather than ticked off. Both conversions are security-invoker database functions
(`accept_finding_as_task`, `accept_finding_as_risk`) that run under the reviewer's own rights in one
transaction. The AI's suggested assignee is a whole-word match against project members and is checked again
by the function at accept time: anyone no longer in the project or organisation is dropped, so crafted
finding data cannot assign work to an outsider. Report text is fenced as data in the prompt.

**Consequences.** No new task model, and the risk log can feed the management summary (Workflow F). The
report keeps a link to every risk it produced; deleting a report keeps its tasks and risks.

## TD-12 · Management summary: facts from one RLS-scoped function, AI may only recommend (2026-11-10)

**Context.** Owners want a weekly picture across projects: overdue work, decisions waiting, procurement
bottlenecks, risks, pipeline and finance warnings. The brief requires real data only, never invented KPIs, and a
clear line between facts, estimates and AI recommendations. Figures must also respect each person's access.

**Decision.** One security-invoker function, `management_summary(org)`, computes every figure as the caller, so
RLS decides what counts; finance facts are returned only with finance access (null, never a misleading zero) and
supplier quote counts only with project finance access. The page labels each figure as a fact or an estimate
(today only the margin of an open proposal if won), and shows suggestions from fixed rules with their reasons.
The AI never produces a figure for display: it receives the facts as data with stable ids, must cite the ids each
recommendation rests on, and every number in its text is checked against the cited facts (unknown ids or
unsupported numbers mark it unverified). Facts are recomputed on the server for each request, never taken from the
browser. Briefs are findings in the shared layer, readable only by their author and organisation admins (S-17).

**Consequences.** The summary cannot disagree with the underlying modules, since it reads the same tables under
the same rules. Week-over-week comparison needs stored snapshots, which this increment does not keep yet.

