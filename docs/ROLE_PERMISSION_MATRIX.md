# Role and permission matrix

Enforced in Postgres (RLS + `private.has_capability`). The UI only mirrors these rules (`src/lib/permissions.ts`).
Tests: `supabase/tests/database/access_control.test.sql` (53 assertions, acting as each kind of user).

## Building blocks

| Layer | Values | Who sets it |
|---|---|---|
| Organisation role | `admin`, `manager`, `staff` | Organisation admin (Settings → Members) |
| Capabilities | `organization_admin` (= the `admin` role), `project_manager`, `finance_access`, `sales_access`, `operations_access`, `viewer_access` (every member's baseline) | Organisation admin |
| Project role | `owner`, `editor`, `viewer` | Project owner (Team tab) |

- Admins hold every capability.
- New members joining through the company email domain start as `staff` with no extra capabilities (viewer).
- People outside the organisation (partners) see only the projects they are invited to, and never finance data.

## Matrix (✅ allowed · — refused by the database)

| Action | Admin | Finance | Sales | Project manager | Operations | Viewer (member) | External partner |
|---|---|---|---|---|---|---|---|
| Read projects they belong to | ✅ all org projects | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ invited only |
| Create projects / leads (incl. RFP import) | ✅ | — | ✅ | ✅ | — | — | — |
| Create / edit clients | ✅ | — | ✅ | ✅ | — | — | — |
| Edit project work (scope, plan, tasks, venues, layouts, BOQ lines) | ✅ | by project role | by project role | by project role | by project role | by project role | by project role |
| Read / write **invoices** | ✅ | ✅ project members | — | — | — | — | — |
| Read / write **expenses** | ✅ | ✅ project members | — | — | — | — | — |
| Read / write **supplier quotes** | ✅ | ✅ project members | — | — | — | — | — |
| Activity lines about invoices, expenses, quotes | ✅ | ✅ | — | — | — | — | — |
| Read / write **proposal internal costs and margin** | ✅ | ✅ | — | — | — | — | — |
| Read **inventory valuation** (unit rate, stock value) | ✅ | ✅ | — | — | — | — | — |
| Read proposals (content and client prices) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Create / edit proposals, sections, items | ✅ | — | ✅ | — | — | — | — |
| Delete proposals, clients, suppliers, inventory | ✅ + managers | role `manager` | role `manager` | role `manager` | role `manager` | — | — |
| Add / edit suppliers | ✅ | ✅ | — | — | ✅ | — | — |
| Add / edit inventory items and quantities | ✅ | — | — | — | ✅ | — | — |
| Request quotes (RFQs) | project editors and owners | | | | | | |
| Manage members, roles, capabilities, email domains | ✅ | — | — | — | — | — | — |

Notes:
- **Finance on project records** requires finance access *and* being on the project (or being an admin).
- **The UI is stricter in one place.** Accepting a quote also awards the RFQ, so it needs finance access *and* the project editor role.
- **Last admin.** An organisation can never lose its last admin; the database refuses the change.
- **Existing members after the migration.**
  - `manager` → project manager + sales + operations (no finance).
  - `staff` → viewer.
  - `admin` → everything.

## Pending business decisions (defaults stay restrictive until decided)

| # | Question | Current default |
|---|---|---|
| D-1 | Should sales see project **budgets** (contract value)? | Visible to project members |
| D-2 | Should procurement/operations see **supplier quote amounts**, or only supplier and status? | Finance only (whole quote) |
| D-3 | Should sales see **invoices** for their accounts? | Finance only |
| D-4 | Should the **tender BOQ unit prices** (client pricing) be restricted to sales/finance? | Visible to project members |
| D-5 | Should domain auto-join require admin approval before membership? | Auto-join as viewer (email confirmation required) |
| D-6 | Should finance users see every project's finance without being added to the project? | No: membership required |
