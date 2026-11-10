-- Workflow E: event operations. Reports from the field (site visits, venue inspections, production updates,
-- daily reports, meeting minutes, handover/handback, wayfinding inspections), an issues and risks log, and
-- AI extraction of action items, issues, risks and decisions through the shared findings layer.
-- Accepted action items become tasks; accepted issues and risks become log rows. Nothing is automatic.

alter table public.ai_usage_logs drop constraint ai_usage_logs_feature_check;
alter table public.ai_usage_logs add constraint ai_usage_logs_feature_check
  check (feature in ('rfp_extract', 'proposal_draft', 'tender_analysis', 'ops_extract'));

create type public.ops_report_kind as enum
  ('site_visit', 'venue_inspection', 'production_update', 'daily_report', 'meeting_minutes', 'handover', 'handback', 'wayfinding_inspection');
create type public.risk_kind as enum ('issue', 'risk');
create type public.risk_level as enum ('low', 'medium', 'high');
create type public.risk_status as enum ('open', 'mitigating', 'closed');

-- An owner or assignee must belong to the project or its organisation.
create or replace function private.owner_in_project_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is not null
     and not exists (select 1 from public.project_members pm where pm.project_id = new.project_id and pm.user_id = new.owner_id)
     and not exists (select 1 from public.organization_members om where om.organization_id = new.organization_id and om.user_id = new.owner_id) then
    raise exception 'The owner must be a member of the project or its organisation' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function private.owner_in_project_check() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Operations reports
-- ---------------------------------------------------------------------------
create table public.ops_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  organization_id uuid not null,
  kind public.ops_report_kind not null default 'daily_report',
  title text not null check (char_length(title) between 1 and 300),
  report_date date not null default current_date,
  location text not null default '' check (char_length(location) <= 300),
  attendees text not null default '' check (char_length(attendees) <= 1000),
  body text not null default '' check (char_length(body) <= 20000),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint ops_reports_project_fk foreign key (project_id, organization_id)
    references public.projects (id, organization_id) on delete cascade
);
create index ops_reports_project_idx on public.ops_reports (project_id, organization_id, report_date desc);
create index ops_reports_created_by_idx on public.ops_reports (created_by);
create trigger ops_reports_updated_at before update on public.ops_reports
  for each row execute function private.set_updated_at();
create trigger ops_reports_activity after insert or update or delete on public.ops_reports
  for each row execute function private.log_activity();

alter table public.ops_reports enable row level security;
create policy "ops reports: members read" on public.ops_reports
  for select to authenticated using ((select private.is_member(project_id)));
create policy "ops reports: editors add" on public.ops_reports
  for insert to authenticated with check (created_by = (select auth.uid()) and (select private.can_edit(project_id)));
create policy "ops reports: editors update" on public.ops_reports
  for update to authenticated using ((select private.can_edit(project_id))) with check ((select private.can_edit(project_id)));
create policy "ops reports: editors delete" on public.ops_reports
  for delete to authenticated using ((select private.can_edit(project_id)));
revoke all on public.ops_reports from anon;
grant select, insert, update, delete on public.ops_reports to authenticated;

-- ---------------------------------------------------------------------------
-- Issues and risks log
-- ---------------------------------------------------------------------------
create table public.project_risks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  organization_id uuid not null,
  kind public.risk_kind not null default 'issue',
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '' check (char_length(description) <= 4000),
  impact public.risk_level not null default 'medium',
  likelihood public.risk_level,
  mitigation text not null default '' check (char_length(mitigation) <= 2000),
  owner_id uuid references auth.users (id) on delete set null,
  due_date date,
  status public.risk_status not null default 'open',
  source_report_id uuid,
  finding_id uuid references public.ai_findings (id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_risks_project_fk foreign key (project_id, organization_id)
    references public.projects (id, organization_id) on delete cascade,
  constraint project_risks_report_fk foreign key (source_report_id, organization_id)
    references public.ops_reports (id, organization_id) on delete set null (source_report_id)
);
create index project_risks_project_idx on public.project_risks (project_id, organization_id, status);
create index project_risks_owner_idx on public.project_risks (owner_id);
create index project_risks_report_idx on public.project_risks (source_report_id, organization_id);
create index project_risks_finding_idx on public.project_risks (finding_id);
create index project_risks_created_by_idx on public.project_risks (created_by);
create trigger project_risks_updated_at before update on public.project_risks
  for each row execute function private.set_updated_at();
create trigger project_risks_activity after insert or update or delete on public.project_risks
  for each row execute function private.log_activity();
create trigger project_risks_owner_check before insert or update of owner_id on public.project_risks
  for each row execute function private.owner_in_project_check();

alter table public.project_risks enable row level security;
create policy "risks: members read" on public.project_risks
  for select to authenticated using ((select private.is_member(project_id)));
create policy "risks: editors add" on public.project_risks
  for insert to authenticated with check (created_by = (select auth.uid()) and (select private.can_edit(project_id)));
create policy "risks: editors update" on public.project_risks
  for update to authenticated using ((select private.can_edit(project_id))) with check ((select private.can_edit(project_id)));
create policy "risks: editors delete" on public.project_risks
  for delete to authenticated using ((select private.can_edit(project_id)));
revoke all on public.project_risks from anon;
grant select, insert, update, delete on public.project_risks to authenticated;

-- ---------------------------------------------------------------------------
-- Accepting operations findings (one transaction each; run as the caller, so RLS decides)
-- ---------------------------------------------------------------------------
create or replace function public.accept_finding_as_task(fid uuid, note text default '')
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  f public.ai_findings;
  assignee uuid;
  due date;
  prio public.task_priority := 'normal';
  tid uuid;
begin
  select * into f from public.ai_findings where id = fid for update;
  if f.id is null then
    raise exception 'Finding not found or not editable by you' using errcode = '42501';
  end if;
  if f.workflow <> 'operations' or f.kind <> 'action_item' or f.project_id is null then
    raise exception 'Only operations action items become tasks' using errcode = '22023';
  end if;
  if f.status <> 'proposed' then
    raise exception 'This finding was already reviewed' using errcode = '22023';
  end if;
  -- The suggested assignee is used only if they still belong to the project or organisation.
  if (f.data ->> 'suggested_assignee_id') ~ '^[0-9a-f-]{36}$' then
    assignee := (f.data ->> 'suggested_assignee_id')::uuid;
    if not (exists (select 1 from public.project_members pm where pm.project_id = f.project_id and pm.user_id = assignee)
            or exists (select 1 from public.organization_members om where om.organization_id = f.organization_id and om.user_id = assignee)) then
      assignee := null;
    end if;
  end if;
  if (f.data ->> 'due_date') ~ '^\d{4}-\d{2}-\d{2}$' then
    begin
      due := (f.data ->> 'due_date')::date;
    exception when others then
      due := null;
    end;
  end if;
  if (f.data ->> 'priority') in ('low', 'normal', 'high', 'urgent') then
    prio := (f.data ->> 'priority')::public.task_priority;
  end if;
  insert into public.tasks (project_id, title, description, assignee_id, due_date, priority)
  values (f.project_id, f.title, left(f.detail, 4000), assignee, due, prio)
  returning id into tid;
  update public.ai_findings
  set status = 'accepted', review_note = left(coalesce(note, ''), 1000), target_table = 'tasks', target_id = tid
  where id = fid;
  return tid;
end;
$$;
revoke execute on function public.accept_finding_as_task(uuid, text) from public, anon;
grant execute on function public.accept_finding_as_task(uuid, text) to authenticated;

create or replace function public.accept_finding_as_risk(fid uuid, note text default '')
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  f public.ai_findings;
  report uuid;
  rid uuid;
begin
  select * into f from public.ai_findings where id = fid for update;
  if f.id is null then
    raise exception 'Finding not found or not editable by you' using errcode = '42501';
  end if;
  if f.workflow <> 'operations' or f.kind not in ('issue', 'risk') or f.project_id is null then
    raise exception 'Only operations issues and risks join the risk log' using errcode = '22023';
  end if;
  if f.status <> 'proposed' then
    raise exception 'This finding was already reviewed' using errcode = '22023';
  end if;
  if (f.data ->> 'report_id') ~ '^[0-9a-f-]{36}$' then
    select r.id into report from public.ops_reports r
    where r.id = (f.data ->> 'report_id')::uuid and r.project_id = f.project_id;
  end if;
  insert into public.project_risks (project_id, organization_id, kind, title, description, impact, likelihood, mitigation, source_report_id, finding_id)
  values (
    f.project_id, f.organization_id, f.kind::public.risk_kind, f.title, left(f.detail, 4000),
    case when f.data ->> 'impact' in ('low', 'medium', 'high') then (f.data ->> 'impact')::public.risk_level else 'medium' end,
    case when f.kind = 'risk' and f.data ->> 'likelihood' in ('low', 'medium', 'high') then (f.data ->> 'likelihood')::public.risk_level end,
    left(coalesce(f.data ->> 'mitigation', ''), 2000), report, f.id
  )
  returning id into rid;
  update public.ai_findings
  set status = 'accepted', review_note = left(coalesce(note, ''), 1000), target_table = 'project_risks', target_id = rid
  where id = fid;
  return rid;
end;
$$;
revoke execute on function public.accept_finding_as_risk(uuid, text) from public, anon;
grant execute on function public.accept_finding_as_risk(uuid, text) to authenticated;
