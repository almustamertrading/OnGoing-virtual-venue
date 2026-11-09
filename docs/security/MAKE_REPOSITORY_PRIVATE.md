# Making the GitHub repository private (owner action, not yet authorised)

The repository is public. Nothing secret is in it ([audit](SECRET_AUDIT_2026-11-09.md)), but the schema, RLS policies and business logic are readable by anyone. Making it private is recommended (finding S-04).

**I will not change the visibility.** Only the owner, or someone with admin rights on the GitHub repository, should do it.

## Steps (about 2 minutes)
1. GitHub → the repository → **Settings** → **General**.
2. Scroll to **Danger Zone** → **Change repository visibility** → **Change to private**.
3. Confirm by typing the repository name.

## What to check afterwards

| Area | Effect | Check |
|---|---|---|
| Netlify deploys | Netlify reads the repository through its GitHub App. Private repositories work if the app has access. | Netlify → Site → Deploys: trigger a deploy, or wait for the next push to `phase-1-foundation`. If it fails, Netlify → Site configuration → Build & deploy → link the repository again. |
| GitHub Actions CI | Private repositories use the account's monthly Actions minutes (the free tier includes a limited allowance). One CI run takes about 8 minutes. | GitHub → Settings → Billing → Actions usage. |
| Claude Code sessions | Need the Claude GitHub App to have access to private repositories. | Start a session; cloning works if access is granted. |
| Links already shared | Public links to files stop working for people without access. | — |
| Forks | None exist. | — |

## Reversible
The visibility can be switched back the same way. Before making it public again, re-run the secret scan.
