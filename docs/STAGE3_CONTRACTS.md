# Stage 3 contracts (parallel workstreams)

Four workstreams build Stage 3 in parallel, in isolated git worktrees branched from `stage3`.
The main agent is the **single migration owner**: it wrote the schema (`supabase/migrations/20261109180000_stage3_modules.sql`)
and its database tests (`supabase/tests/database/stage3_modules.test.sql`, 38 passing). It reviews and merges each workstream.

## Rules for every workstream

1. **Migrations and database tests.** Do not create or edit anything under `supabase/`. If you need a schema change, describe it in your final report and the migration owner adds it.
2. **Shared files.** Do not edit these (the migration owner owns them):
   - `src/lib/types.ts`, `src/lib/permissions.ts`, `src/lib/project.ts`, `src/lib/supabase/*`;
   - `src/components/app-header.tsx`, `src/components/main-nav.tsx`;
   - `src/app/projects/[projectId]/(workspace)/layout.tsx`, `workspace-tabs.tsx`;
   - `playwright.config.ts`, `e2e/support/*`, `e2e/smoke.spec.ts`, `e2e/account.spec.ts`;
   - `package.json`, `package-lock.json`: no new dependencies; use the platform (`Intl`, `<input type="date">`) and existing libraries.

   Need a change in one of them? Put it in your report.
3. **Security.**
   - Never use a service-role or secret key in app code; every query goes through the signed-in user's client (`createClient()` from `@/lib/supabase/server`), so RLS decides access.
   - Validate input in server actions.
   - Return `permissionMessage(error)` from `@/lib/permissions` for refused writes.
   - Finance data (invoices, expenses, quotes, costs, confidential documents) comes only through RLS-filtered queries or the report and feed functions. Never compute it from other tables.
4. **Next.js 16 rules** (read `node_modules/next/dist/docs/` before writing code):
   - Every dynamic route needs a `loading.tsx` (Cache Components).
   - Call `createClient()` before anything that reads the current time; it already calls `connection()`.
   - Route props use the generated `PageProps<"/route">`; `npm run typecheck` runs `next typegen` first.
5. **UI conventions.**
   - Dark theme utility classes from `globals.css`: `card`, `field`, `label`, `btn-primary`, `btn-ghost`.
   - Arabic, right-to-left content (`dir="rtl"` on `<main>`); `AppHeader` with breadcrumbs.
   - Accessible: labelled inputs, `role="alert"` / `role="status"` for messages, keyboard reachable.
   - Must work at 375 px width: no horizontal page scroll; wide tables scroll inside their own container.
   - Reuse `Restricted` (`@/components/restricted`) when a user lacks a permission.
6. **Tests.** Required before you finish:
   - `npm run typecheck`, `npm run lint`, `npm test` (Vitest: unit tests for your pure logic).
   - Your Playwright spec, run in your own namespace and port: `E2E_NAMESPACE=<ns> E2E_PORT=<port> npx playwright test e2e/<module>.spec.ts`
   - Never run `supabase db reset`, `supabase test db` or `supabase stop`: the local database is shared.
   - Each namespace gets its own QA organisation, seeded fresh by `e2e/global-setup.ts`:
     - users `admin`, `finance`, `sales`, `pm`, `ops`, `viewer`, `account` and `outsider` (see `e2e/support/qa.ts`);
     - a project "QA Gala Dinner" with finance data;
     - a proposal, a supplier and an inventory item.
   - Extra data for your tests: create it through the UI, or in your spec with a local admin client (`localSupabase()` from `e2e/support/local-supabase.ts` returns the local service-role key; tests only, local only).
   - Wait for `page.waitForLoadState("networkidle")` before interacting with a page that was just compiled in dev mode.
7. **Finish.** Commit your work in your worktree with a clear message; do not push. Report:
   - files changed;
   - tests added and passing, with the commands;
   - any requested shared-file or schema changes;
   - known limitations.

## Workstream A: Settings & Administration (namespace `settings`, port 3201)
- **Owns:** `src/app/settings/**`, except `account/` and `members/actions.ts`; you may restyle `members/` pages. Also `src/lib/settings*.ts` (+ tests) and `e2e/settings.spec.ts`.
- **Build:**
  - Settings layout with section navigation: Account (existing), Organisation, Members (existing), Email domains, Audit log.
  - `/settings` redirects to `/settings/account`.
  - **Organisation** (`/settings/organization`): name, currency, time zone (validated list from `Intl.supportedValuesOf('timeZone')`), default VAT rate, VAT/tax number, address, phone, website. Admins edit; others see read-only.
  - **Email domains** (`/settings/domains`): list, add (lower-case domain format), remove. Explain that people with these domains join automatically as viewers.
  - **Audit log** (`/settings/audit`, admins): newest first, paginated, actor and target emails (via `profiles`), action labels in Arabic, readable details.
- **Contracts:**
  - `organizations`: columns `timezone`, `default_vat_rate`, `tax_number`, `address`, `phone`, `website`, `updated_at`. Admins update; members read; an invalid time zone raises `22023`.
  - `organization_domains`: admins insert and delete; members read.
  - `organization_audit`: admins read; written only by triggers.

## Workstream B: Global Calendar & Scheduling (namespace `calendar`, port 3202)
- **Owns:** `src/app/calendar/**`, `src/lib/calendar*.ts` (+ tests), `e2e/calendar.spec.ts`.
- **Build:**
  - `/calendar`: month view (default), week view and an agenda list, with filters by project and source type.
  - **Data:** one call to the RPC `calendar_feed(org, range_start, range_end)` (see `CalendarFeedItem` in `types.ts`).
  - **Event dialog:**
    - Create, edit and delete custom events (`calendar_events`), organisation-wide or for a project.
    - Kinds: meeting, site visit, rehearsal, load-in, event day, deadline, other.
    - Warn about time overlaps with existing events, as a scheduling aid.
  - Each item links to its source (project, proposal, task) where one exists.
- **Contracts:**
  - `calendar_feed` respects the caller's access: invoices appear only for finance users. All-day items use `start_date`/`end_date`; timed events also have `starts_at`/`ends_at`.
  - `calendar_events` write rule:
    - organisation-wide events: admins or members with a working capability (`private.can_contribute`);
    - project events: project editors.

## Workstream C: Central Document Management (namespace `documents`, port 3203)
- **Owns:** `src/app/documents/**`, `src/app/projects/[projectId]/(workspace)/documents/**` (the tab link already exists), `src/lib/documents*.ts` (+ tests), `e2e/documents.spec.ts`.
- **Build:**
  - `/documents`: organisation library listing organisation and project documents the user can see, with search, category filter, project filter and version history.
  - Project tab: that project's documents.
  - **Upload:** browser → Storage directly (Server Actions have a 1 MB body limit), path `<organization_id>/<project_id | org>/<new uuid>/<safe file name>`. Then a server action inserts the `documents` row. If the insert fails, delete the uploaded object.
  - **Download:** through `createSignedUrl` with a short expiry.
  - **New version:** upload, then insert a row with `supersedes_id` and `version + 1`.
  - Edit title, category and confidential flag; delete (the row and the object).
- **Contracts:**
  - `documents` columns are in `DocumentRow`; max 50 MB; private bucket `documents`.
  - `storage_path` must start with `<organization_id>/<project_id | org>/` (CHECK constraint).
  - Read: members of the project or organisation; confidential documents only for finance (and admins).
  - Write:
    - project documents: project editors;
    - organisation documents: contributors;
    - confidential documents: only users with finance access.
  - Storage objects are readable only when the document row is readable.

## Workstream D: Reports & Analytics (namespace `reports`, port 3204)
- **Owns:** `src/app/reports/**`, `src/lib/reports*.ts` (+ tests), `e2e/reports.spec.ts`.
- **Build:**
  - `/reports` dashboard:
    - pipeline (projects by status, budget totals);
    - proposals funnel and win rate;
    - delivery (task completion, overdue, blocked, next milestone per project);
    - procurement (RFQs and awards);
    - finance per project: invoiced, paid, outstanding, expenses, margin. Shown only when rows come back, otherwise `Restricted`.
  - CSV export of each table, built from what the user can see.
  - Charts as accessible inline SVG, no new libraries, with text equivalents.
- **Contracts:** RPCs `report_pipeline`, `report_proposals`, `report_project_finance`, `report_delivery` and `report_procurement`, each taking `org uuid`; row types in `types.ts`. They run as the caller:
  - finance rows only for finance users;
  - procurement `quotes` / `awarded_value` are `null` without finance access.
