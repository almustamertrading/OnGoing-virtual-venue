# Mirror verification tools (release S3-4)

How the release was verified on an isolated, production-shaped database (results in `../READINESS.md`).
The mirror setup (second local stack on ports 553xx, production's structure loaded from a read-only
export that is never committed) is described in `../../2026-11-S1-5/mirror-tools/README.md`.

1. **Rebuild the mirror at "production after S1-5":** `supabase db reset` on the mirror (production's 10
   migrations), load the production-shaped data, then apply S1-5's two migrations in one transaction.
2. **Baseline:** `snapshot.sh <dir> before` (schema dump of `public` and `private` from inside the database
   container, storage buckets and policies, and the data fingerprint of every public table).
3. **Migrate:** `run_apply.sh <dir>` applies both release migrations in one transaction while a second
   connection measures read latency. Then `snapshot.sh <dir> after` and compare.
4. **App compatibility:** `node compat_check.cjs <app url> <label> [--new]` signs in as the mirror owner and
   checks the key pages (with `--new`, also the pages this release adds). Run the release S1-5 app and the
   new app against the migrated mirror, and the new app against the un-migrated mirror.
5. **Roll back:** run `../rollback.sql` with `psql -1`, then `snapshot.sh <dir> after_rollback` and diff with
   the baseline. Zero differences in all three files means the rollback is exact.
6. **Database tests on the mirror:** `npx supabase test db --db-url "postgresql://postgres:postgres@127.0.0.1:55322/postgres?sslmode=disable"`.

## Production pre-flight (read-only, counts only)

Run before applying; every count except the last three must be 0.

```sql
select
  (select count(*) from public.organization_domains
    where domain in ('gmail.com','googlemail.com','outlook.com','hotmail.com','live.com','msn.com','yahoo.com','ymail.com',
                     'icloud.com','me.com','mac.com','aol.com','proton.me','protonmail.com','gmx.com','gmx.net','mail.com',
                     'yandex.com','zoho.com','hotmail.co.uk','outlook.sa','hotmail.sa')) as public_mail_domains,
  (select count(*) from storage.buckets where id = 'documents') as documents_bucket_exists,
  (select count(*) from pg_policies where schemaname = 'storage' and policyname like 'documents bucket:%') as storage_policy_name_clashes,
  (select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname in ('calendar_event_kind', 'document_category')) as type_clashes,
  (select count(*) from information_schema.tables where table_schema = 'public'
    and table_name in ('calendar_events','documents','organization_audit','ai_usage_logs','proposal_templates','proposal_versions','proposal_reviews')) as table_clashes,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'organizations'
    and column_name in ('timezone','default_vat_rate','tax_number','address','phone','website','updated_at')) as organization_column_clashes,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'proposals'
    and column_name in ('template_id','submitted_at','approved_by','approved_at')) as proposal_column_clashes,
  (select coalesce(json_object_agg(status, n), '{}'::json) from (select status, count(*) as n from public.proposals group by status) s) as proposals_by_status,
  (select count(*) from public.proposals where version <> 1) as proposals_with_version_other_than_1,
  (select count(*) from public.organizations) as organizations;
```
