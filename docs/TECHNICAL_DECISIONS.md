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
