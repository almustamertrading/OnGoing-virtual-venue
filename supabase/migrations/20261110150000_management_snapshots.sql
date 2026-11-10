-- Management intelligence (Workflow F, increment 2): one snapshot per user per week of the management summary
-- figures, so the summary can show the change since the previous week. A snapshot is the user's own view, so
-- it is private to them and never changed. Finance figures are never stored: someone who loses finance access
-- must not keep reading them through old snapshots.

create or replace function private.has_finance_keys(j jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (select 1 from jsonb_object_keys(j) k where k like 'finance.%');
$$;
grant execute on function private.has_finance_keys(jsonb) to authenticated;

create table public.management_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Weeks start on Sunday (the Saudi working week), in the organisation's time zone.
  week_start date not null check (extract(dow from week_start) = 0),
  facts jsonb not null
    check (jsonb_typeof(facts) = 'object' and octet_length(facts::text) <= 65536 and not private.has_finance_keys(facts)),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id, week_start)
);
create index management_snapshots_user_idx on public.management_snapshots (user_id);

alter table public.management_snapshots enable row level security;
create policy "management snapshots: own read" on public.management_snapshots
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_org_member(organization_id)));
create policy "management snapshots: own add" on public.management_snapshots
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_org_member(organization_id)));
create policy "management snapshots: own delete" on public.management_snapshots
  for delete to authenticated
  using (user_id = (select auth.uid()));
-- No update: a snapshot records what was true that week. (Default privileges would otherwise grant it.)
revoke all on public.management_snapshots from anon, authenticated;
grant select, insert, delete on public.management_snapshots to authenticated;
