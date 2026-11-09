# Secret and private-data audit (2026-11-09)

**Scope:**
- every commit on every branch, 21 commits in total;
- the current working tree;
- the development session logs, counted only.

No values are printed in this report or were printed during the scan.

## Method
- A scanner read `git log --all -p` (every added line in every commit) and looked for:
  - Supabase secret and publishable keys;
  - JWTs, decoding only the role and issuer claims;
  - Anthropic and OpenAI-style keys, GitHub tokens, AWS keys;
  - private key blocks, database URLs with passwords, password assignments;
  - Saudi phone numbers, and email addresses (grouped by domain).
- Committed `.env*` files were listed.
- Git history was searched for client names, contact names, invoice numbers and supplier names taken from the production data (list in the private report).

## Results

| Check | Result |
|---|---|
| Service-role / secret keys, private keys, cloud or AI provider keys, GitHub tokens | **None** in any commit |
| JWTs | **None** in any commit |
| `.env` files committed | Only `.env.example`: the public URL and publishable key; the AI key is left blank |
| Database URL with password | 1, in `scripts/db/check-rbac-backfill.sh`: the **local** Supabase default (`postgres:postgres@127.0.0.1`), not a secret |
| Password assignments | 2: the throw-away password for the **local** QA test users (`e2e/support/qa.ts`, local database only), and password-policy setting names in `supabase/config.toml` |
| Phone numbers | None |
| Email domains | Company domains on the public marketing site; reserved `.test` domains in test fixtures; a template default in `supabase/config.toml` |
| Client or contact names, amounts, invoice or supplier names from production | **None**. A sample proposal reference appears once, as a format example in a migration comment |

### Session logs (private to the owner's Claude session)
- **Admin and QA account passwords:** present. This is incident S-02; see [CREDENTIAL_ROTATION_CHECKLIST.md](CREDENTIAL_ROTATION_CHECKLIST.md).
- **Keys:**
  - 2 local demo keys (public defaults);
  - 1 production **anon** key (low privilege, public by design).
  - No service-role key, Anthropic key or tokens.

## Conclusion
Nothing in the repository or its history needs rewriting or rotation. The only exposed credentials are user passwords in private session logs.

## Prevention in place
- **TD-02:** no production business data in the repository.
- **`.gitignore`:** covers `.env*.local`, test sessions (`e2e/.auth/`) and test output.
- **Test runners refuse non-local databases:** `e2e/support/local-supabase.ts` and `scripts/db/check-rbac-backfill.sh`.
- Re-run this scanner before making the repository public again, or as a CI step if the repository stays public.
