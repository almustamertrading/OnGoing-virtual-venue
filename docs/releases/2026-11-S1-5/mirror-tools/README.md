# Mirror verification tools (release S1-5)

How the release was verified on an isolated, production-shaped database (results in `../READINESS.md`).

1. **Start a second local Supabase stack.** Copy `supabase/config.toml` with `project_id = "ongoing-mirror"` and every port moved from 543xx to 553xx. Put production's 10 migrations in its `supabase/migrations`, then run `supabase start`.
2. **Export production's structure, read-only.** Use the query in `EXPORT.sql`: IDs, relationships, roles, statuses and amounts, with no names, emails or free text. It returns a JSON file. That file is production-derived data, so it is never committed (TD-02).
3. **Build and load the mirror data:**
   ```bash
   python3 build_mirror_sql.py prod_shape.json > load.sql
   ```
   Load it with `psql`. Triggers are bypassed so the rows match production exactly.
4. **Take the baseline:** a schema-only `pg_dump` of the `public` and `private` schemas, plus `fingerprint.sql` (row count and content hash per table).
5. **Migrate:** `run_apply.sh` applies both migrations in one transaction while a second connection measures read latency.
6. **Check app compatibility:** `node compat_check.cjs <app url> <label>` signs in as the mirror owner and checks 11 key pages. Run it with the live app (deploy branch) and with the release candidate, each pointed at the mirror.
7. **Roll back:** run `../rollback.sql`, then repeat step 4 and diff. Zero differences means the rollback is exact.
