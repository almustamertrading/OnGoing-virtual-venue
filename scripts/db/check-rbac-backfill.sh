#!/usr/bin/env bash
# Checks that the RBAC expand migration moves internal costs without loss.
# LOCAL ONLY: resets the local Supabase database to the migration before RBAC,
# loads synthetic rows, applies the remaining migrations and asserts the result.
# Leaves the local database fully migrated (with the synthetic rows).
set -euo pipefail

DB_URL="${LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
case "$DB_URL" in
  *127.0.0.1*|*localhost*) ;;
  *) echo "Refusing to run against a non-local database: $DB_URL" >&2; exit 1 ;;
esac

cd "$(dirname "$0")/../.."
npx supabase db reset --local --version 20261109120000
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f scripts/db/rbac-backfill-fixture.sql
npx supabase migration up --local
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f scripts/db/rbac-backfill-assert.sql
