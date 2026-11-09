#!/usr/bin/env bash
# Applies the release migrations to the MIRROR in one transaction while a reader measures latency.
set -u
M="$(dirname "$0")"; R=/home/user/ongoing-virtual-venue
DB=postgresql://postgres:postgres@127.0.0.1:55322/postgres
printf '\\timing on\n\\i %s/supabase/migrations/20261109160000_db_hygiene.sql\n\\i %s/supabase/migrations/20261109170000_rbac_capabilities.sql\n' "$R" "$R" > "$M/apply_release.sql"
reader() {
  local end=$(( $(date +%s) + 14 ))
  while [ "$(date +%s)" -lt "$end" ]; do
    local s=$(date +%s%N)
    psql "$DB" -At -c "select (select count(*) from public.proposal_items) + (select count(*) from public.invoices) + (select count(*) from public.projects) + (select count(*) from public.activity)" >/dev/null 2>&1
    local e=$(date +%s%N); echo $(( (e - s) / 1000000 )); sleep 0.05
  done
}
reader > "$M/reader_latency.txt" &
sleep 4
S=$(date +%s%N)
psql "$DB" -1 -v ON_ERROR_STOP=1 -q -f "$M/apply_release.sql" > "$M/apply_timing.txt" 2>&1; RC=$?
E=$(date +%s%N)
wait
echo "migration exit=$RC wall_ms=$(( (E - S) / 1000000 ))"
echo "reader samples=$(wc -l < "$M/reader_latency.txt") median_ms=$(sort -n "$M/reader_latency.txt" | awk '{a[NR]=$1} END {print a[int(NR/2)+1]}') max_ms=$(sort -n "$M/reader_latency.txt" | tail -1)"
grep '^Time:' "$M/apply_timing.txt" | awk '{s+=$2; if ($2>m) m=$2} END {printf "statements=%d sum_ms=%.1f slowest_ms=%.1f\n", NR, s, m}'
grep -i 'error' "$M/apply_timing.txt" | head -3
