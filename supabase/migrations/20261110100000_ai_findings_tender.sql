-- Shared AI layer: findings with source traceability and human review (used by every AI workflow),
-- and the first workflow built on it: tender intelligence with a requirements register (Workflow A).
--
-- Principles enforced here, not only in the app:
-- * AI proposes, people decide: findings are created as 'proposed'; review stamps (who, when) are set by a
--   trigger; nothing becomes a register row until a person with edit rights accepts it.
-- * Provenance is permanent: what the AI said, where (document, page, excerpt) and which AI request produced
--   it cannot be edited after creation.
-- * Finance-sensitive findings are readable only with finance access to the project.

-- ---------------------------------------------------------------------------
-- 1. AI usage log: the tender analysis feature
-- ---------------------------------------------------------------------------
alter table public.ai_usage_logs drop constraint ai_usage_logs_feature_check;
alter table public.ai_usage_logs add constraint ai_usage_logs_feature_check
  check (feature in ('rfp_extract', 'proposal_draft', 'tender_analysis'));

-- ---------------------------------------------------------------------------
-- 2. AI findings
-- ---------------------------------------------------------------------------
create table public.ai_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid,
  document_id uuid,
  workflow text not null check (workflow in ('tender', 'boq', 'pricing', 'procurement', 'operations', 'management')),
  kind text not null check (kind ~ '^[a-z_]{1,40}$'),
  title text not null check (char_length(title) between 1 and 300),
  detail text not null default '' check (char_length(detail) <= 4000),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  finance_only boolean not null default false,
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'rejected')),
  source_page integer check (source_page is null or source_page >= 1),
  source_excerpt text not null default '' check (char_length(source_excerpt) <= 600),
  source_verified boolean not null default false,
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  ai_usage_log_id bigint references public.ai_usage_logs (id) on delete set null,
  target_table text check (target_table is null or target_table ~ '^[a-z_]{1,60}$'),
  target_id uuid,
  review_note text not null default '' check (char_length(review_note) <= 1000),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ai_findings_project_fk foreign key (project_id, organization_id)
    references public.projects (id, organization_id) on delete cascade,
  constraint ai_findings_document_fk foreign key (document_id, organization_id)
    references public.documents (id, organization_id) on delete set null (document_id)
);
create index ai_findings_project_idx on public.ai_findings (project_id, organization_id, workflow, status);
create index ai_findings_org_idx on public.ai_findings (organization_id, workflow, status);
create index ai_findings_document_idx on public.ai_findings (document_id, organization_id);
create index ai_findings_usage_idx on public.ai_findings (ai_usage_log_id);
create index ai_findings_created_by_idx on public.ai_findings (created_by);
create index ai_findings_reviewed_by_idx on public.ai_findings (reviewed_by);

create or replace function private.ai_findings_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    return new; -- service role and migrations: trusted maintenance
  end if;
  if tg_op = 'INSERT' then
    -- New findings are always proposals; review stamps are never client-supplied.
    new.status := 'proposed';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.target_table := null;
    new.target_id := null;
    new.review_note := '';
    return new;
  end if;

  -- Provenance never changes (links may only be cleared, when the linked row is deleted).
  if (new.organization_id, new.project_id, new.workflow, new.kind, new.title, new.detail, new.severity, new.finance_only,
      new.source_page, new.source_excerpt, new.source_verified, new.data, new.created_at)
     is distinct from
     (old.organization_id, old.project_id, old.workflow, old.kind, old.title, old.detail, old.severity, old.finance_only,
      old.source_page, old.source_excerpt, old.source_verified, old.data, old.created_at)
     or (new.document_id is distinct from old.document_id and new.document_id is not null)
     or (new.ai_usage_log_id is distinct from old.ai_usage_log_id and new.ai_usage_log_id is not null)
     or (new.created_by is distinct from old.created_by and new.created_by is not null) then
    raise exception 'An AI finding keeps its original content and source' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'proposed' and new.status in ('accepted', 'rejected') then
      new.reviewed_by := caller;
      new.reviewed_at := now();
    elsif new.status = 'proposed' then
      -- Reopened: the earlier decision no longer applies.
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.target_table := null;
      new.target_id := null;
      new.review_note := '';
    else
      raise exception 'Reopen a reviewed finding before deciding it again' using errcode = '22023';
    end if;
  elsif (new.reviewed_at, new.target_table, new.target_id, new.review_note)
        is distinct from (old.reviewed_at, old.target_table, old.target_id, old.review_note)
        or (new.reviewed_by is distinct from old.reviewed_by and new.reviewed_by is not null) then
    raise exception 'Review details are recorded only with a decision' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.ai_findings_guard() from public, anon, authenticated;
create trigger ai_findings_guard before insert or update on public.ai_findings
  for each row execute function private.ai_findings_guard();

alter table public.ai_findings enable row level security;
create policy "ai findings: read" on public.ai_findings
  for select to authenticated
  using (
    (select private.is_org_member(organization_id))
    and (project_id is null or (select private.is_member(project_id)))
    and (
      not finance_only
      or (project_id is not null and (select private.can_access_project_finance(project_id)))
      or (project_id is null and (select private.has_capability(organization_id, 'finance_access')))
    )
  );
create policy "ai findings: add" on public.ai_findings
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and status = 'proposed'
    and (
      (project_id is null and (select private.can_contribute(organization_id)))
      or (project_id is not null and (select private.can_edit(project_id)))
    )
    and (
      not finance_only
      or (project_id is not null and (select private.can_access_project_finance(project_id)))
      or (project_id is null and (select private.has_capability(organization_id, 'finance_access')))
    )
  );
create policy "ai findings: review" on public.ai_findings
  for update to authenticated
  using (
    (project_id is null and (select private.can_contribute(organization_id)))
    or (project_id is not null and (select private.can_edit(project_id)))
  )
  with check (
    (project_id is null and (select private.can_contribute(organization_id)))
    or (project_id is not null and (select private.can_edit(project_id)))
  );
create policy "ai findings: admins delete" on public.ai_findings
  for delete to authenticated
  using ((select private.is_org_admin(organization_id)));
revoke all on public.ai_findings from anon;
grant select, insert, update, delete on public.ai_findings to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tender requirements register
-- ---------------------------------------------------------------------------
create type public.requirement_category as enum
  ('document', 'certificate', 'bond', 'insurance', 'form', 'site_visit', 'deadline', 'eligibility', 'technical', 'other');
create type public.requirement_status as enum ('open', 'in_progress', 'met', 'not_applicable');

create table public.project_requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  organization_id uuid not null,
  title text not null check (char_length(title) between 1 and 300),
  category public.requirement_category not null default 'other',
  details text not null default '' check (char_length(details) <= 2000),
  mandatory boolean not null default true,
  status public.requirement_status not null default 'open',
  owner_id uuid references auth.users (id) on delete set null,
  due_date date,
  -- The document that satisfies the requirement (evidence), not the tender document it came from.
  document_id uuid,
  finding_id uuid references public.ai_findings (id) on delete set null,
  source_ref text not null default '' check (char_length(source_ref) <= 200),
  sort_order double precision not null default 0,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint project_requirements_project_fk foreign key (project_id, organization_id)
    references public.projects (id, organization_id) on delete cascade,
  constraint project_requirements_document_fk foreign key (document_id, organization_id)
    references public.documents (id, organization_id) on delete set null (document_id)
);
create index project_requirements_project_idx on public.project_requirements (project_id, organization_id, sort_order);
create index project_requirements_owner_idx on public.project_requirements (owner_id);
create index project_requirements_document_idx on public.project_requirements (document_id, organization_id);
create index project_requirements_finding_idx on public.project_requirements (finding_id);
create index project_requirements_created_by_idx on public.project_requirements (created_by);
create trigger project_requirements_updated_at before update on public.project_requirements
  for each row execute function private.set_updated_at();
create trigger project_requirements_activity after insert or update or delete on public.project_requirements
  for each row execute function private.log_activity();

-- An owner must belong to the project or its organisation.
create or replace function private.project_requirements_check()
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
revoke execute on function private.project_requirements_check() from public, anon, authenticated;
create trigger project_requirements_check before insert or update of owner_id on public.project_requirements
  for each row execute function private.project_requirements_check();

alter table public.project_requirements enable row level security;
create policy "requirements: members read" on public.project_requirements
  for select to authenticated using ((select private.is_member(project_id)));
create policy "requirements: editors add" on public.project_requirements
  for insert to authenticated
  with check (created_by = (select auth.uid()) and (select private.can_edit(project_id)));
create policy "requirements: editors update" on public.project_requirements
  for update to authenticated
  using ((select private.can_edit(project_id))) with check ((select private.can_edit(project_id)));
create policy "requirements: editors delete" on public.project_requirements
  for delete to authenticated using ((select private.can_edit(project_id)));
revoke all on public.project_requirements from anon;
grant select, insert, update, delete on public.project_requirements to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Accepting a tender finding as a register row, in one transaction
-- ---------------------------------------------------------------------------
-- Runs as the caller: RLS decides (only project editors can lock and update the finding).
create or replace function public.accept_finding_as_requirement(fid uuid, note text default '')
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  f public.ai_findings;
  cat public.requirement_category := 'other';
  due date;
  doc_title text;
  rid uuid;
begin
  select * into f from public.ai_findings where id = fid for update;
  if f.id is null then
    raise exception 'Finding not found or not editable by you' using errcode = '42501';
  end if;
  if f.workflow <> 'tender' or f.project_id is null then
    raise exception 'Only project tender findings become requirements' using errcode = '22023';
  end if;
  if f.status <> 'proposed' then
    raise exception 'This finding was already reviewed' using errcode = '22023';
  end if;
  if (f.data ->> 'category') in ('document', 'certificate', 'bond', 'insurance', 'form', 'site_visit', 'deadline', 'eligibility', 'technical', 'other') then
    cat := (f.data ->> 'category')::public.requirement_category;
  end if;
  if (f.data ->> 'due_date') ~ '^\d{4}-\d{2}-\d{2}$' then
    begin
      due := (f.data ->> 'due_date')::date;
    exception when others then
      due := null;
    end;
  end if;
  select d.title into doc_title from public.documents d where d.id = f.document_id;

  insert into public.project_requirements (project_id, organization_id, title, category, details, mandatory, due_date, finding_id, source_ref)
  values (
    f.project_id, f.organization_id, f.title, cat, left(f.detail, 2000),
    case when f.data ->> 'mandatory' = 'false' then false else true end,
    due, f.id,
    left(concat_ws(' · ', doc_title, case when f.source_page is not null then 'صفحة ' || f.source_page end), 200)
  )
  returning id into rid;

  update public.ai_findings
  set status = 'accepted', review_note = left(coalesce(note, ''), 1000), target_table = 'project_requirements', target_id = rid
  where id = fid;
  return rid;
end;
$$;
revoke execute on function public.accept_finding_as_requirement(uuid, text) from public, anon;
grant execute on function public.accept_finding_as_requirement(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Calendar: requirement due dates join the feed
-- ---------------------------------------------------------------------------
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
  union all
  select 'requirement', rq.id, rq.project_id, p.code, rq.title, true, rq.due_date, rq.due_date,
         null, null, rq.category::text, rq.status::text
  from public.project_requirements rq
  join public.projects p on p.id = rq.project_id
  where p.organization_id = org and rq.due_date between range_start and range_end
$$;
revoke execute on function public.calendar_feed(uuid, date, date) from public, anon;
grant execute on function public.calendar_feed(uuid, date, date) to authenticated;
