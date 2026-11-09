# Security report

Last updated: 2026-11-09. The repository is **public**, so this report lists IDs and categories only, never
business data, credentials or personal details.

Severity: Critical / High / Medium / Low / Info.
Status: OPEN, IN PROGRESS, MITIGATED (risk reduced, not fixed), FIXED (fixed and tested), OWNER ACTION.

## Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| S-01 | High | Financial data is visible too widely. Internal costs and margins (proposal item costs, inventory valuation, expenses, supplier quotes, invoices) can be read by every organisation member, or every project member for project-level data. | FIXED locally, migration `20261109130000`, with 53 pgTAP tests and smoke 9a/9b passing. Not yet in production (S1-5). Interim: every non-admin account in production is banned, so only the owner's admin account is active. |
| S-02 | High | The primary admin account's password was set during automated setup and was used in plain text in development session transcripts. The account has 25 active sessions, mostly from automated test runs. | OWNER ACTION: change the password in the app or Supabase dashboard, then sign out all other sessions. |
| S-03 | High | Three QA accounts with known passwords exist in production. One of them held owner rights on a project with financial data. | MITIGATED: all three banned and sessions revoked on 2026-11-09 (reversible: `banned_until = null`). Deletion awaits owner approval ([cleanup plan](cleanup/CLEANUP_PLAN.md), Group A). |
| S-04 | Medium | The GitHub repository is public. Anyone can read the schema, the RLS policies and the business logic. | OWNER ACTION: make the repository private. Checked: no secrets in the current tree or in git history (searched for service keys, secret keys and QA credentials). |
| S-05 | Medium | Signup is open, and any mailbox on the company domain joins the organisation automatically as staff. Today, staff can read organisation-wide proposals, clients, suppliers and inventory. | MITIGATED by email confirmation, which is enabled in production, so a mailbox is required. RBAC (S1-4) removes financial access from default staff. Pending decision: whether domain auto-join should require admin approval. |
| S-06 | Medium | AI calls (RFP extraction, proposal drafts) have no per-user rate limit, no usage log and no duplicate-request guard, so a user can run up provider costs. | OPEN: Stage 4 (AI cost control) runs before any further AI work. |
| S-07 | Low | An orphaned temporary RFP upload (a tender PDF) remains in the `rfp-uploads` bucket from a failed read before the cleanup fix. | OPEN: listed for removal in the cleanup plan, pending approval. The code already deletes temporary uploads in a `finally` block. |
| S-08 | Low | Cross-tenant reference integrity. Ten foreign keys do not include the tenant column (`project_id` / `organization_id`). For example, a member of one organisation could attach an item to another organisation's proposal if they knew its UUID. No read exposure was found, because RLS still filters by the child row's own tenant. | FIXED locally, migration `20261109120000`. Tested by reproducing the attack on the old schema (it succeeded) and on the new one (rejected). The two task links remain trigger-enforced. Not yet in production. |
| S-12 | Low | A project owner could change the project's `organization_id`, pushing it into another tenant. | FIXED locally (`projects_keep_organization` trigger) and tested. |
| S-09 | Low | Leaked-password protection (HaveIBeenPwned check) is disabled in Supabase Auth. | OWNER ACTION: Dashboard → Authentication → Providers → Email → enable leaked-password protection (may require a paid plan). |
| S-10 | Info | The pre-cleanup snapshot schema `ops_backup_20261109` holds a copy of `auth.users`, including password hashes. | Accepted for a short time. No grants to `anon` or `authenticated`, and not exposed through the API. Drop it 30 days after the cleanup. |
| S-11 | Info | The publishable key is in the browser bundle by design, so RLS is the only barrier. | Verified: RLS is enabled on every public table (security advisor shows no RLS lint). The app never uses the service-role key. AI keys are server-side only. |

## Interim actions taken (production)

| When (UTC) | Action | Reversible by |
|---|---|---|
| 2026-11-09 15:58 | Banned the QA account `f0b3270f-…` and revoked its sessions | `update auth.users set banned_until = null where id = '…'` |
| 2026-11-09 16:40 | Banned the QA accounts `dd88c9dd-…` and `703fd035-…` and revoked their sessions | same |
| 2026-11-09 | Created the snapshot schema `ops_backup_20261109` (31 tables, 430 rows) | `drop schema ops_backup_20261109 cascade` |

No production rows have been deleted.

## Access model (target, S1-4)

See [ROLE_PERMISSION_MATRIX.md](ROLE_PERMISSION_MATRIX.md). Until the business approves a final role policy,
internal costs and margins are restricted to organisation admins and users explicitly given `finance_access`.
