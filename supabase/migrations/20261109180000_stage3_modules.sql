-- Stage 3 modules (Phase 2): Settings & Administration, Global Calendar, Central Documents,
-- Reports & Analytics. Single migration owner; the UI workstreams build on these contracts
-- (docs/STAGE3_CONTRACTS.md).
--
-- Every function that returns data runs as the CALLER (security invoker), so the existing
-- RLS rules (project membership, finance confidentiality) apply to calendar and report data.

-- ---------------------------------------------------------------------------
-- 0. Helper: can this member add organisation-level content?
-- ---------------------------------------------------------------------------

-- Admins, and members holding any working capability (not viewer-only members).
create or replace function private.can_contribute(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = oid
      and om.user_id = (select auth.uid())
      and (
        om.role = 'admin'
        or om.capabilities && array['project_manager', 'sales_access', 'operations_access', 'finance_access']::public.capability[]
      )
  );
$$;
revoke execute on function private.can_contribute(uuid) from public, anon;
grant execute on function private.can_contribute(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Settings & Administration
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column timezone text not null default 'Asia/Riyadh',
  add column default_vat_rate numeric(5, 2) not null default 15
    check (default_vat_rate >= 0 and default_vat_rate <= 100),
  add column tax_number text check (tax_number is null or char_length(tax_number) <= 40),
  add column address text check (address is null or char_length(address) <= 500),
  add column phone text check (phone is null or char_length(phone) <= 40),
  add column website text check (website is null or char_length(website) <= 200),
  add column updated_at timestamptz not null default now();

create or replace function private.organizations_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Reject unknown time zones (raises invalid_parameter_value).
  perform now() at time zone new.timezone;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.organizations_before_update() from public, anon, authenticated;
create trigger organizations_before_update before update on public.organizations
  for each row execute function private.organizations_before_update();

-- Admin audit trail: membership, role, capability, domain and settings changes.
-- Written only by triggers; readable by organisation admins. User ids are kept as plain
-- values (no foreign key) so the history survives user deletion.
create table public.organization_audit (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid,
  action text not null check (action in (
    'member_added', 'member_removed', 'role_changed', 'capabilities_changed',
    'domain_added', 'domain_removed', 'settings_changed'
  )),
  target_user_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index organization_audit_org_created_idx on public.organization_audit (organization_id, created_at desc);

alter table public.organization_audit enable row level security;
create policy "org audit: admins read" on public.organization_audit
  for select to authenticated using ((select private.is_org_admin(organization_id)));
revoke all on public.organization_audit from anon, authenticated;
grant select on public.organization_audit to authenticated;

create or replace function private.audit_organization_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
  actor uuid := (select auth.uid());
  changed text[];
begin
  if tg_table_name = 'organizations' then
    org := new.id;
  elsif tg_op = 'DELETE' then
    org := old.organization_id;
  else
    org := new.organization_id;
  end if;
  -- Skip when the organisation itself is being deleted (cascade).
  if org is null or not exists (select 1 from public.organizations o where o.id = org) then
    return null;
  end if;

  if tg_table_name = 'organization_members' then
    if tg_op = 'INSERT' then
      insert into public.organization_audit (organization_id, actor_id, action, target_user_id, details)
      values (org, actor, 'member_added', new.user_id,
              jsonb_build_object('role', new.role, 'capabilities', to_jsonb(new.capabilities)));
    elsif tg_op = 'DELETE' then
      insert into public.organization_audit (organization_id, actor_id, action, target_user_id, details)
      values (org, actor, 'member_removed', old.user_id, jsonb_build_object('role', old.role));
    else
      if new.role is distinct from old.role then
        insert into public.organization_audit (organization_id, actor_id, action, target_user_id, details)
        values (org, actor, 'role_changed', new.user_id, jsonb_build_object('from', old.role, 'to', new.role));
      end if;
      if new.capabilities is distinct from old.capabilities then
        insert into public.organization_audit (organization_id, actor_id, action, target_user_id, details)
        values (org, actor, 'capabilities_changed', new.user_id,
                jsonb_build_object('from', to_jsonb(old.capabilities), 'to', to_jsonb(new.capabilities)));
      end if;
    end if;
  elsif tg_table_name = 'organization_domains' then
    if tg_op = 'INSERT' then
      insert into public.organization_audit (organization_id, actor_id, action, details)
      values (org, actor, 'domain_added', jsonb_build_object('domain', new.domain));
    else
      insert into public.organization_audit (organization_id, actor_id, action, details)
      values (org, actor, 'domain_removed', jsonb_build_object('domain', old.domain));
    end if;
  else
    select array_agg(key order by key) into changed
    from jsonb_each(to_jsonb(new)) n
    where n.key not in ('updated_at') and n.value is distinct from to_jsonb(old) -> n.key;
    if changed is not null then
      insert into public.organization_audit (organization_id, actor_id, action, details)
      values (org, actor, 'settings_changed', jsonb_build_object('changed', to_jsonb(changed)));
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function private.audit_organization_change() from public, anon, authenticated;

create trigger organization_members_audit after insert or update or delete on public.organization_members
  for each row execute function private.audit_organization_change();
create trigger organization_domains_audit after insert or delete on public.organization_domains
  for each row execute function private.audit_organization_change();
create trigger organizations_audit after update on public.organizations
  for each row execute function private.audit_organization_change();

-- ---------------------------------------------------------------------------
-- 2. Global Calendar & Scheduling
-- ---------------------------------------------------------------------------

create type public.calendar_event_kind as enum
  ('meeting', 'site_visit', 'rehearsal', 'load_in', 'event_day', 'deadline', 'other');

-- Custom events. project_id is optional: null means an organisation-wide event.
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid,
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '' check (char_length(description) <= 4000),
  location text not null default '' check (char_length(location) <= 300),
  kind public.calendar_event_kind not null default 'meeting',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at),
  constraint calendar_events_project_fk foreign key (project_id, organization_id)
    references public.projects (id, organization_id) on delete cascade
);
create index calendar_events_org_starts_idx on public.calendar_events (organization_id, starts_at);
create index calendar_events_project_fk_idx on public.calendar_events (project_id, organization_id);
create index calendar_events_created_by_idx on public.calendar_events (created_by);
create trigger calendar_events_updated_at before update on public.calendar_events
  for each row execute function private.set_updated_at();
create trigger calendar_events_activity after insert or update or delete on public.calendar_events
  for each row execute function private.log_activity();

alter table public.calendar_events enable row level security;
create policy "calendar events: read" on public.calendar_events
  for select to authenticated
  using (
    (project_id is null and (select private.is_org_member(organization_id)))
    or (project_id is not null and (select private.is_member(project_id)))
  );
create policy "calendar events: add" on public.calendar_events
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (project_id is null and (select private.can_contribute(organization_id)))
      or (project_id is not null and (select private.can_edit(project_id)))
    )
  );
create policy "calendar events: update" on public.calendar_events
  for update to authenticated
  using (
    (project_id is null and (select private.can_contribute(organization_id)))
    or (project_id is not null and (select private.can_edit(project_id)))
  )
  with check (
    (project_id is null and (select private.can_contribute(organization_id)))
    or (project_id is not null and (select private.can_edit(project_id)))
  );
create policy "calendar events: delete" on public.calendar_events
  for delete to authenticated
  using (
    (project_id is null and (select private.can_contribute(organization_id)))
    or (project_id is not null and (select private.can_edit(project_id)))
  );
revoke all on public.calendar_events from anon;
grant select, insert, update, delete on public.calendar_events to authenticated;

-- One feed of everything dated in an organisation, filtered by the caller's own access:
-- custom events, project spans, milestones, task due dates, plan phases, proposal deadlines,
-- RFQ deadlines and (finance users only, through RLS) invoice due dates.
-- All-day items carry dates; timed events carry timestamps and dates in the organisation's zone.
create or replace function public.calendar_feed(org uuid, range_start date, range_end date)
returns table (
  source text,
  source_id uuid,
  project_id uuid,
  label text,
  title text,
  all_day boolean,
  start_date date,
  end_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  kind text,
  status text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with tz as (
    select coalesce((select o.timezone from public.organizations o where o.id = org), 'Asia/Riyadh') as zone
  )
  select 'event', e.id, e.project_id, p.code, e.title, e.all_day,
         (e.starts_at at time zone tz.zone)::date, (e.ends_at at time zone tz.zone)::date,
         case when e.all_day then null else e.starts_at end,
         case when e.all_day then null else e.ends_at end,
         e.kind::text, null
  from public.calendar_events e
  cross join tz
  left join public.projects p on p.id = e.project_id
  where e.organization_id = org
    and (e.starts_at at time zone tz.zone)::date <= range_end
    and (e.ends_at at time zone tz.zone)::date >= range_start
  union all
  select 'project', p.id, p.id, p.code, p.name, true, p.start_date, coalesce(p.end_date, p.start_date),
         null, null, p.project_type::text, p.status::text
  from public.projects p
  where p.organization_id = org and p.start_date is not null
    and p.start_date <= range_end and coalesce(p.end_date, p.start_date) >= range_start
  union all
  select 'submission', p.id, p.id, p.code, p.name, true,
         left(p.submission_deadline, 10)::date, left(p.submission_deadline, 10)::date,
         null, null, 'deadline', p.status::text
  from public.projects p
  where p.organization_id = org and p.submission_deadline ~ '^\d{4}-\d{2}-\d{2}'
    and left(p.submission_deadline, 10)::date between range_start and range_end
  union all
  select 'milestone', m.id, m.project_id, p.code, m.title, true, m.due_date, m.due_date,
         null, null, 'milestone', case when m.done then 'done' else 'open' end
  from public.milestones m
  join public.projects p on p.id = m.project_id
  where p.organization_id = org and m.due_date between range_start and range_end
  union all
  select 'task', t.id, t.project_id, p.code, t.title, true, t.due_date, t.due_date,
         null, null, 'task', t.status::text
  from public.tasks t
  join public.projects p on p.id = t.project_id
  where p.organization_id = org and t.due_date between range_start and range_end
  union all
  select 'phase', ph.id, ph.project_id, p.code, ph.title, true, ph.start_date, coalesce(ph.end_date, ph.start_date),
         null, null, 'phase', null
  from public.plan_phases ph
  join public.projects p on p.id = ph.project_id
  where p.organization_id = org and ph.start_date is not null
    and ph.start_date <= range_end and coalesce(ph.end_date, ph.start_date) >= range_start
  union all
  select 'proposal', pr.id, pr.project_id, pr.reference, pr.title, true, pr.due_date, pr.due_date,
         null, null, 'deadline', pr.status::text
  from public.proposals pr
  where pr.organization_id = org and pr.due_date between range_start and range_end
  union all
  select 'rfq', r.id, r.project_id, p.code, r.title, true, r.due_date, r.due_date,
         null, null, 'deadline', r.status::text
  from public.rfqs r
  join public.projects p on p.id = r.project_id
  where p.organization_id = org and r.due_date between range_start and range_end
  union all
  select 'invoice', i.id, i.project_id, p.code, coalesce(nullif(i.title, ''), i.number), true, i.due_date, i.due_date,
         null, null, 'invoice', i.status::text
  from public.invoices i
  join public.projects p on p.id = i.project_id
  where p.organization_id = org and i.due_date between range_start and range_end
$$;
revoke execute on function public.calendar_feed(uuid, date, date) from public, anon;
grant execute on function public.calendar_feed(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Central Document Management
-- ---------------------------------------------------------------------------

create type public.document_category as enum
  ('contract', 'rfp', 'proposal', 'drawing', 'permit', 'invoice', 'photo', 'report', 'other');

-- Files live in the private `documents` bucket at
--   <organization_id>/<project_id | 'org'>/<document_id>/<file name>
-- A new version is a new row (and object) that supersedes the previous one.
-- Confidential documents (e.g. priced contracts) follow the finance rule.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid,
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '' check (char_length(description) <= 4000),
  category public.document_category not null default 'other',
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 300),
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 52428800),
  version integer not null default 1 check (version >= 1),
  supersedes_id uuid,
  is_confidential boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint documents_project_fk foreign key (project_id, organization_id)
    references public.projects (id, organization_id) on delete cascade,
  constraint documents_supersedes_fk foreign key (supersedes_id, organization_id)
    references public.documents (id, organization_id) on delete set null (supersedes_id),
  -- The object path must sit under this row's organisation and project folder, so storage
  -- access (checked by path) and row access (checked by RLS) can never disagree.
  constraint documents_path_matches check (
    storage_path like organization_id::text || '/' || coalesce(project_id::text, 'org') || '/%'
  )
);
create index documents_org_created_idx on public.documents (organization_id, created_at desc);
create index documents_project_fk_idx on public.documents (project_id, organization_id);
create index documents_supersedes_fk_idx on public.documents (supersedes_id, organization_id);
create index documents_created_by_idx on public.documents (created_by);
create trigger documents_updated_at before update on public.documents
  for each row execute function private.set_updated_at();
create trigger documents_activity after insert or update or delete on public.documents
  for each row execute function private.log_activity();

alter table public.documents enable row level security;
create policy "documents: read" on public.documents
  for select to authenticated
  using (
    (project_id is null
      and (select private.is_org_member(organization_id))
      and (not is_confidential or (select private.has_capability(organization_id, 'finance_access'))))
    or (project_id is not null
      and (select private.is_member(project_id))
      and (not is_confidential or (select private.can_access_project_finance(project_id))))
  );
create policy "documents: add" on public.documents
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (project_id is null
        and (select private.can_contribute(organization_id))
        and (not is_confidential or (select private.has_capability(organization_id, 'finance_access'))))
      or (project_id is not null
        and (select private.can_edit(project_id))
        and (not is_confidential or (select private.can_access_project_finance(project_id))))
    )
  );
create policy "documents: update" on public.documents
  for update to authenticated
  using (
    (project_id is null
      and (select private.can_contribute(organization_id))
      and (not is_confidential or (select private.has_capability(organization_id, 'finance_access'))))
    or (project_id is not null
      and (select private.can_edit(project_id))
      and (not is_confidential or (select private.can_access_project_finance(project_id))))
  )
  with check (
    (project_id is null
      and (select private.can_contribute(organization_id))
      and (not is_confidential or (select private.has_capability(organization_id, 'finance_access'))))
    or (project_id is not null
      and (select private.can_edit(project_id))
      and (not is_confidential or (select private.can_access_project_finance(project_id))))
  );
create policy "documents: delete" on public.documents
  for delete to authenticated
  using (
    (project_id is null
      and (select private.can_contribute(organization_id))
      and (not is_confidential or (select private.has_capability(organization_id, 'finance_access'))))
    or (project_id is not null
      and (select private.can_edit(project_id))
      and (not is_confidential or (select private.can_access_project_finance(project_id))))
  );
revoke all on public.documents from anon;
grant select, insert, update, delete on public.documents to authenticated;

-- Storage: reading an object requires being able to read its document row; uploading or
-- deleting requires write access to the folder (organisation contributors for 'org',
-- project editors for a project folder of the same organisation).
create or replace function private.can_write_document_path(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org uuid;
  scope text := split_part(object_name, '/', 2);
  pid uuid;
begin
  org := split_part(object_name, '/', 1)::uuid;
  if scope = 'org' then
    return private.can_contribute(org);
  end if;
  pid := scope::uuid;
  return private.can_edit(pid)
    and exists (select 1 from public.projects p where p.id = pid and p.organization_id = org);
exception when invalid_text_representation then
  return false;
end;
$$;
revoke execute on function private.can_write_document_path(text) from public, anon;
grant execute on function private.can_write_document_path(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do nothing;

create policy "documents bucket: read via document row" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (select 1 from public.documents d where d.storage_path = storage.objects.name)
  );
create policy "documents bucket: upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (select private.can_write_document_path(name)));
create policy "documents bucket: delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (select private.can_write_document_path(name)));

-- ---------------------------------------------------------------------------
-- 4. Reports & Analytics (security invoker: RLS decides what each caller sees)
-- ---------------------------------------------------------------------------

create or replace function public.report_pipeline(org uuid)
returns table (status public.project_status, projects bigint, budget_total numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.status, count(*), coalesce(sum(p.budget), 0)
  from public.projects p
  where p.organization_id = org
  group by p.status
$$;

create or replace function public.report_proposals(org uuid)
returns table (status public.proposal_status, proposals bigint, value_total numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select pr.status, count(distinct pr.id),
         coalesce(sum(case when not i.is_optional then i.quantity * i.unit_price end), 0)
  from public.proposals pr
  left join public.proposal_items i on i.proposal_id = pr.id
  where pr.organization_id = org
  group by pr.status
$$;

-- Finance per project: only projects whose finance the caller may see appear at all.
create or replace function public.report_project_finance(org uuid)
returns table (
  project_id uuid, code text, name text, status public.project_status, budget numeric,
  invoiced numeric, paid numeric, outstanding numeric, expenses numeric, margin numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.code, p.name, p.status, p.budget,
         coalesce(inv.total, 0), coalesce(inv.paid, 0), coalesce(inv.total, 0) - coalesce(inv.paid, 0),
         coalesce(ex.total, 0), coalesce(inv.total, 0) - coalesce(ex.total, 0)
  from public.projects p
  left join lateral (
    select sum(i.amount) as total, sum(i.amount) filter (where i.status = 'paid') as paid
    from public.invoices i where i.project_id = p.id
  ) inv on true
  left join lateral (
    select sum(e.amount) as total from public.expenses e where e.project_id = p.id
  ) ex on true
  where p.organization_id = org
    and (select private.can_access_project_finance(p.id))
$$;

create or replace function public.report_delivery(org uuid)
returns table (
  project_id uuid, code text, name text, status public.project_status,
  tasks_total bigint, tasks_done bigint, tasks_overdue bigint, tasks_blocked bigint,
  milestones_total bigint, milestones_done bigint, next_milestone date
)
language sql
stable
security invoker
set search_path = ''
as $$
  -- "Today" is the organisation's local date (not the server's UTC date), as on the task board.
  with local_day as (
    select (now() at time zone coalesce((select o.timezone from public.organizations o where o.id = org), 'Asia/Riyadh'))::date as today
  )
  select p.id, p.code, p.name, p.status,
         coalesce(t.total, 0), coalesce(t.done, 0), coalesce(t.overdue, 0), coalesce(t.blocked, 0),
         coalesce(m.total, 0), coalesce(m.done, 0), m.next_due
  from public.projects p
  cross join local_day d
  left join lateral (
    select count(*) as total,
           count(*) filter (where x.status = 'done') as done,
           count(*) filter (where x.status <> 'done' and x.due_date < d.today) as overdue,
           count(*) filter (where x.status = 'blocked') as blocked
    from public.tasks x where x.project_id = p.id
  ) t on true
  left join lateral (
    select count(*) as total, count(*) filter (where y.done) as done,
           min(y.due_date) filter (where not y.done and y.due_date >= d.today) as next_due
    from public.milestones y where y.project_id = p.id
  ) m on true
  where p.organization_id = org
$$;

-- Supplier quote figures are internal costs: null unless the caller has project finance access.
create or replace function public.report_procurement(org uuid)
returns table (
  project_id uuid, code text, name text, rfqs bigint, rfqs_awarded bigint,
  quotes bigint, awarded_value numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.code, p.name,
         coalesce(r.total, 0), coalesce(r.awarded, 0),
         case when (select private.can_access_project_finance(p.id)) then coalesce(q.total, 0) end,
         case when (select private.can_access_project_finance(p.id)) then coalesce(q.awarded_value, 0) end
  from public.projects p
  left join lateral (
    select count(*) as total, count(*) filter (where x.status = 'awarded') as awarded
    from public.rfqs x where x.project_id = p.id
  ) r on true
  left join lateral (
    select count(*) as total, sum(y.amount) filter (where y.status = 'accepted') as awarded_value
    from public.quotes y where y.project_id = p.id
  ) q on true
  where p.organization_id = org
$$;

revoke execute on function public.report_pipeline(uuid), public.report_proposals(uuid),
  public.report_project_finance(uuid), public.report_delivery(uuid), public.report_procurement(uuid)
  from public, anon;
grant execute on function public.report_pipeline(uuid), public.report_proposals(uuid),
  public.report_project_finance(uuid), public.report_delivery(uuid), public.report_procurement(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Hardening found during module integration
-- ---------------------------------------------------------------------------

-- 6a. Confidential documents must not leak through the project activity feed. Their title is
--     masked when logged, and the line is readable only with finance access to the project.
create or replace function private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  prev jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  pid uuid;
  changed text[];
  label text;
  confidential boolean;
  ignored text[] := array['updated_at', 'updated_by', 'geom', 'completed_at', 'sort_order'];
  info jsonb;
begin
  pid := case when tg_table_name = 'projects' then (rec ->> 'id')::uuid else (rec ->> 'project_id')::uuid end;
  -- Skip rows whose project is being deleted in the same statement.
  if pid is null or not exists (select 1 from public.projects p where p.id = pid) then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    select array_agg(key order by key) into changed
    from jsonb_each(rec) n
    where not (n.key = any (ignored)) and n.value is distinct from prev -> n.key;
    if changed is null then
      return null;
    end if;
    -- Map shapes change on every drag; only renames and layer moves are worth a line.
    if tg_table_name = 'features' and not (changed && array['name', 'layer_id']) then
      return null;
    end if;
  end if;

  confidential := tg_table_name = 'documents'
    and (coalesce((rec ->> 'is_confidential')::boolean, false) or coalesce((prev ->> 'is_confidential')::boolean, false));
  label := case when confidential then 'مستند سري' else coalesce(rec ->> 'title', rec ->> 'name', rec ->> 'body', '') end;
  info := jsonb_build_object('label', left(label, 140));
  if confidential then
    info := info || jsonb_build_object('confidential', true);
  end if;
  if changed is not null then
    info := info || jsonb_build_object('changed', to_jsonb(changed));
    if 'status' = any (changed) then
      info := info || jsonb_build_object('from', prev ->> 'status', 'to', rec ->> 'status');
    end if;
  end if;
  if tg_table_name = 'project_members' then
    info := info || jsonb_build_object(
      'member', (select p.email from public.profiles p where p.id = (rec ->> 'user_id')::uuid),
      'role', rec ->> 'role'
    );
  end if;

  insert into public.activity (project_id, actor_id, action, entity_type, entity_id, details)
  values (
    pid,
    (select auth.uid()),
    case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    tg_table_name,
    case when tg_table_name = 'project_members' then (rec ->> 'user_id')::uuid else (rec ->> 'id')::uuid end,
    info
  );
  return null;
end;
$$;

drop policy "activity: members read" on public.activity;
create policy "activity: members read" on public.activity
  for select to authenticated
  using (
    (select private.is_member(project_id))
    and (
      (entity_type <> all (array['invoices', 'expenses', 'quotes'])
       and not (entity_type = 'documents' and coalesce((details ->> 'confidential')::boolean, false)))
      or (select private.can_access_project_finance(project_id))
    )
  );

-- 6b. Cleanup after a failed upload: storage's remove() needs read access, and the bucket's read
--     policy follows the document row. Uploaders may therefore see (and so remove) their own
--     objects that no document row points to. They uploaded these files, so nothing new is exposed.
create or replace function private.document_path_claimed(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.documents d where d.storage_path = object_name);
$$;
revoke execute on function private.document_path_claimed(text) from public, anon;
grant execute on function private.document_path_claimed(text) to authenticated;
create policy "documents bucket: uploader sees own unclaimed objects" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and owner_id = (select auth.uid())::text
    and not private.document_path_claimed(name)
  );

-- 6c. Automatic membership by email domain must never use a public mailbox provider: anyone with
--     a free address there could otherwise join the organisation.
alter table public.organization_domains add constraint organization_domains_not_public_provider check (
  domain not in (
    'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'ymail.com',
    'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.net', 'mail.com',
    'yandex.com', 'zoho.com', 'hotmail.co.uk', 'outlook.sa', 'hotmail.sa'
  )
);
