#!/usr/bin/env bash
# Snapshot of the MIRROR for exact before/after comparison: schema, storage config, data fingerprint.
# Usage: snapshot.sh <output dir> <label>
set -eu
T="$(cd "$(dirname "$0")" && pwd)"; OUT="$1"; L="$2"
DB=postgresql://postgres:postgres@127.0.0.1:55322/postgres
# pg_dump from inside the database container, so its version matches the server (17).
# pg_dump 17 adds a random \restrict token on every run; it is not part of the schema.
docker exec supabase_db_ongoing-mirror pg_dump -U postgres -d postgres --schema-only -n public -n private --no-owner | grep -v -E '^\\(un)?restrict ' > "$OUT/schema_$L.sql"
psql "$DB" -At -f "$T/storage_state.sql" > "$OUT/storage_$L.txt"
psql "$DB" -At -f "$T/fingerprint.sql" > "$OUT/data_$L.txt"
echo "$L: $(wc -l < "$OUT/schema_$L.sql") schema lines, $(wc -l < "$OUT/storage_$L.txt") storage entries, $(wc -l < "$OUT/data_$L.txt") tables"
