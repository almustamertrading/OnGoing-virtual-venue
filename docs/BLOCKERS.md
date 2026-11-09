# Blockers

Items that need the owner, money, credentials or an outside party. Development continues around each one.

| ID | Blocker | Blocks | Needed from | Workaround in place |
|---|---|---|---|---|
| B-01 | Approval of the production cleanup list ([plan](cleanup/CLEANUP_PLAN.md)) | Deleting QA records, users and storage files | Owner | QA accounts are banned; scripts are ready and dry-run tested |
| B-02 | Primary admin account password must be changed (SECURITY_REPORT S-02) | Closing S-02 | Owner | None: only the owner can do this |
| B-03 | Repository is public (S-04) | Closing S-04 | Owner (GitHub → Settings → General → Change visibility) | No business data or secrets are committed (TD-02) |
| B-04 | Leaked-password protection is off (S-09) | Closing S-09 | Owner (Supabase dashboard; may need a paid plan) | Minimum password length of 8 |
| B-05 | No development Anthropic API key. The key exists only in the Netlify production environment. | Live verification of AI features outside production, including generation time against the hosting time limit | Owner: a separate low-limit key for development/CI | Provider interface with a deterministic mock (TD-07); all AI flows are tested with it. Live AI verification stays marked "pending". |
| B-06 | Deleting storage objects needs the service role or the dashboard | Step 3 of the cleanup | Owner (dashboard) after B-01 | — |
| B-07 | Final business role policy (who sees budgets, quotes, invoices) | Loosening the default financial restrictions | Owner | Least-privilege defaults: finance data is admin + `finance_access` only ([matrix](ROLE_PERMISSION_MATRIX.md)) |
| B-08 | Approval for release S1-5: snapshot, two migrations, deploy | Production RBAC enforcement | Owner (explicitly required) | [Readiness report](releases/2026-11-S1-5/READINESS.md): mirror-verified migration, exact rollback, runbook |
| B-09 | AFC portal (ac27loc) data requires a login | Importing AFC venue data | Owner (credentials or exports) | — |
| B-10 | A hosted staging project costs money | A shared staging URL | Owner | Local Supabase in Docker serves development and CI (TD-01) |
