-- Proposal Builder Phase 2 + AI cost control (Phase 2, Stage 4).
--
-- 1. ai_usage_logs: every AI call (provider, model, feature, tokens, latency, errors),
--    the data behind per-user rate limits and the duplicate-request guard.
-- 2. proposal_templates: organisation templates (section headings + guidance).
-- 3. Internal review workflow: proposal_reviews; approval only by managers/admins;
--    nothing goes to the client before internal approval; approved content is locked.
-- 4. proposal_versions: immutable snapshots taken automatically at submission, approval
--    and sending (and on demand). Snapshots never contain internal costs.

-- ---------------------------------------------------------------------------
-- 1. AI usage log
-- ---------------------------------------------------------------------------

create table public.ai_usage_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  feature text not null check (feature in ('rfp_extract', 'proposal_draft')),
  provider text not null check (provider in ('anthropic', 'mock')),
  model text not null default '',
  status text not null default 'started'
    check (status in ('started', 'success', 'error', 'refused', 'rate_limited')),
  error_code text check (error_code is null or char_length(error_code) <= 60),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  input_tokens integer not null default 0 check (input_tokens between 0 and 2000000),
  output_tokens integer not null default 0 check (output_tokens between 0 and 200000),
  cache_read_tokens integer not null default 0 check (cache_read_tokens between 0 and 2000000),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index ai_usage_logs_user_feature_idx on public.ai_usage_logs (user_id, feature, created_at desc);
create index ai_usage_logs_org_created_idx on public.ai_usage_logs (organization_id, created_at desc);
-- Only one identical request may be in flight per user: a concurrent duplicate fails (23505).
create unique index ai_usage_logs_one_in_flight on public.ai_usage_logs (user_id, feature, request_hash)
  where status = 'started';

-- Who, what and when are fixed once written, so the window used for rate limits cannot be gamed.
create or replace function private.ai_usage_logs_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id or new.organization_id is distinct from old.organization_id
     or new.feature is distinct from old.feature or new.request_hash is distinct from old.request_hash
     or new.created_at is distinct from old.created_at or new.provider is distinct from old.provider then
    raise exception 'AI usage records cannot be rewritten' using errcode = '42501';
  end if;
  if old.status <> 'started' then
    raise exception 'A finished AI usage record cannot change' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.ai_usage_logs_guard() from public, anon, authenticated;
create trigger ai_usage_logs_guard before update on public.ai_usage_logs
  for each row execute function private.ai_usage_logs_guard();

alter table public.ai_usage_logs enable row level security;
create policy "ai usage: own or admin read" on public.ai_usage_logs
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_org_admin(organization_id)));
create policy "ai usage: own insert" on public.ai_usage_logs
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status in ('started', 'rate_limited')
    and (organization_id is null or (select private.is_org_member(organization_id)))
  );
create policy "ai usage: own finish" on public.ai_usage_logs
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.ai_usage_logs from anon;
grant select, insert, update on public.ai_usage_logs to authenticated;

-- Tokens an organisation used this calendar month (members may ask; the rows stay private).
create or replace function public.ai_org_tokens_this_month(org uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.is_org_member(org) then
    (select coalesce(sum(l.input_tokens + l.output_tokens), 0)
     from public.ai_usage_logs l
     where l.organization_id = org and l.created_at >= date_trunc('month', now()))
  end;
$$;
revoke execute on function public.ai_org_tokens_this_month(uuid) from public, anon;
grant execute on function public.ai_org_tokens_this_month(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Proposal templates
-- ---------------------------------------------------------------------------

create table public.proposal_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  proposal_type public.proposal_type not null default 'technical_financial',
  description text not null default '' check (char_length(description) <= 2000),
  -- [{"heading": "...", "guidance": "..."}]
  sections jsonb not null default '[]'
    check (jsonb_typeof(sections) = 'array' and jsonb_array_length(sections) <= 30),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, name)
);
create index proposal_templates_created_by_idx on public.proposal_templates (created_by);
create trigger proposal_templates_updated_at before update on public.proposal_templates
  for each row execute function private.set_updated_at();

alter table public.proposal_templates enable row level security;
create policy "proposal templates: members read" on public.proposal_templates
  for select to authenticated using ((select private.is_org_member(organization_id)));
create policy "proposal templates: sales add" on public.proposal_templates
  for insert to authenticated
  with check (created_by = (select auth.uid()) and (select private.has_capability(organization_id, 'sales_access')));
create policy "proposal templates: sales update" on public.proposal_templates
  for update to authenticated
  using ((select private.has_capability(organization_id, 'sales_access')))
  with check ((select private.has_capability(organization_id, 'sales_access')));
create policy "proposal templates: sales delete" on public.proposal_templates
  for delete to authenticated using ((select private.has_capability(organization_id, 'sales_access')));
revoke all on public.proposal_templates from anon;
grant select, insert, update, delete on public.proposal_templates to authenticated;

alter table public.proposals
  add column template_id uuid,
  add column submitted_at timestamptz,
  add column approved_by uuid references auth.users (id) on delete set null,
  add column approved_at timestamptz,
  add constraint proposals_template_fk foreign key (template_id, organization_id)
    references public.proposal_templates (id, organization_id) on delete set null (template_id);
create index proposals_template_idx on public.proposals (template_id, organization_id);
create index proposals_approved_by_idx on public.proposals (approved_by);

-- ---------------------------------------------------------------------------
-- 3. Versions (immutable snapshots, never with internal costs)
-- ---------------------------------------------------------------------------

create table public.proposal_versions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null,
  organization_id uuid not null,
  version integer not null check (version >= 1),
  status public.proposal_status not null,
  note text not null default '' check (char_length(note) <= 500),
  snapshot jsonb not null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (proposal_id, version),
  constraint proposal_versions_proposal_fk foreign key (proposal_id, organization_id)
    references public.proposals (id, organization_id) on delete cascade
);
create index proposal_versions_proposal_idx on public.proposal_versions (proposal_id, organization_id);
create index proposal_versions_created_by_idx on public.proposal_versions (created_by);

alter table public.proposal_versions enable row level security;
create policy "proposal versions: members read" on public.proposal_versions
  for select to authenticated using ((select private.is_org_member(organization_id)));
-- No insert/update/delete policies: versions are written only by the functions below.
revoke all on public.proposal_versions from anon, authenticated;
grant select on public.proposal_versions to authenticated;

-- Client-facing content of a proposal: header, sections and priced items. Internal costs
-- (proposal_item_costs) are deliberately left out.
create or replace function private.proposal_snapshot(pid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'proposal', (
      select jsonb_build_object(
        'title', p.title, 'reference', p.reference, 'proposal_type', p.proposal_type,
        'summary', p.summary, 'client_id', p.client_id, 'vat_rate', p.vat_rate,
        'issue_date', p.issue_date, 'due_date', p.due_date, 'valid_until', p.valid_until)
      from public.proposals p where p.id = pid),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object('heading', s.heading, 'body', s.body, 'ai_generated', s.ai_generated)
                       order by s.sort_order, s.created_at)
      from public.proposal_sections s where s.proposal_id = pid), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'category', i.category, 'description', i.description, 'specification', i.specification,
               'quantity', i.quantity, 'unit', i.unit, 'unit_price', i.unit_price, 'is_optional', i.is_optional)
             order by i.sort_order, i.created_at)
      from public.proposal_items i where i.proposal_id = pid), '[]'::jsonb)
  );
$$;
revoke execute on function private.proposal_snapshot(uuid) from public, anon, authenticated;

-- Manual "save version" (sales): snapshot the current content and start the next version.
create or replace function public.save_proposal_version(pid uuid, note text default '')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.proposals;
begin
  select * into p from public.proposals where id = pid for update;
  if p.id is null or not private.has_capability(p.organization_id, 'sales_access') then
    raise exception 'Not allowed to version this proposal' using errcode = '42501';
  end if;
  insert into public.proposal_versions (proposal_id, organization_id, version, status, note, snapshot)
  values (p.id, p.organization_id, p.version, p.status, left(coalesce(note, ''), 500), private.proposal_snapshot(p.id));
  update public.proposals set version = p.version + 1 where id = p.id;
  return p.version;
end;
$$;
revoke execute on function public.save_proposal_version(uuid, text) from public, anon;
grant execute on function public.save_proposal_version(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Workflow: approval gate, timestamps, automatic versions
-- ---------------------------------------------------------------------------

create or replace function private.proposals_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  -- No caller means the service role or a migration: trusted maintenance, not a user.
  manager boolean := caller is null or private.is_org_manager(new.organization_id);
begin
  if tg_op = 'INSERT' then
    if caller is not null then
      if new.status not in ('draft', 'ai_generated') and not manager then
        raise exception 'A new proposal starts as a draft' using errcode = '42501';
      end if;
      new.approved_by := null;
      new.approved_at := null;
      new.submitted_at := null;
      new.version := 1;
    end if;
    return new;
  end if;

  -- Approval fields and the version number are written here only, never directly by a user.
  if caller is not null
     and (new.approved_by, new.approved_at, new.submitted_at) is distinct from (old.approved_by, old.approved_at, old.submitted_at) then
    raise exception 'Approval fields are set by the review workflow' using errcode = '42501';
  end if;
  if caller is not null and new.version is distinct from old.version
     and not (new.version = old.version + 1
              and exists (select 1 from public.proposal_versions v where v.proposal_id = old.id and v.version = old.version)) then
    raise exception 'The version number is managed by the version history' using errcode = '42501';
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'approved_internally' and not manager then
    raise exception 'Only an organisation admin or manager can approve a proposal' using errcode = '42501';
  end if;
  if new.status in ('sent_to_client', 'awaiting_response', 'accepted', 'converted')
     and old.approved_at is null and not manager then
    raise exception 'The proposal must be approved internally before it goes to the client' using errcode = '42501';
  end if;

  if new.status = 'under_review' then
    new.submitted_at := now();
  end if;
  if new.status = 'approved_internally' then
    new.approved_by := caller;
    new.approved_at := now();
  elsif new.status in ('draft', 'ai_generated', 'under_review', 'changes_requested') then
    -- Back to editing or a new submission: an earlier approval no longer applies, so the
    -- content must be approved again before it can go to the client.
    new.approved_by := null;
    new.approved_at := null;
  end if;

  -- Submission, approval and sending each freeze the current content as a version.
  if new.status in ('under_review', 'approved_internally', 'sent_to_client') then
    insert into public.proposal_versions (proposal_id, organization_id, version, status, snapshot)
    values (old.id, old.organization_id, old.version, new.status, private.proposal_snapshot(old.id));
    new.version := old.version + 1;
  end if;
  return new;
end;
$$;
revoke execute on function private.proposals_workflow() from public, anon, authenticated;
create trigger proposals_workflow before insert or update on public.proposals
  for each row execute function private.proposals_workflow();

-- Content can be edited only while the proposal is being drafted or revised. It is locked
-- during review, so the reviewer approves exactly what was submitted.
create or replace function private.proposal_is_editable(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.proposals p
    where p.id = pid and p.status in ('draft', 'ai_generated', 'changes_requested')
  );
$$;
revoke execute on function private.proposal_is_editable(uuid) from public, anon;
grant execute on function private.proposal_is_editable(uuid) to authenticated;

drop policy "proposal sections: sales add" on public.proposal_sections;
drop policy "proposal sections: sales update" on public.proposal_sections;
drop policy "proposal sections: sales delete" on public.proposal_sections;
create policy "proposal sections: sales add" on public.proposal_sections
  for insert to authenticated
  with check (created_by = (select auth.uid()) and (select private.has_capability(organization_id, 'sales_access'))
              and (select private.proposal_is_editable(proposal_id)));
create policy "proposal sections: sales update" on public.proposal_sections
  for update to authenticated
  using ((select private.has_capability(organization_id, 'sales_access')) and (select private.proposal_is_editable(proposal_id)))
  with check ((select private.has_capability(organization_id, 'sales_access')) and (select private.proposal_is_editable(proposal_id)));
create policy "proposal sections: sales delete" on public.proposal_sections
  for delete to authenticated
  using ((select private.has_capability(organization_id, 'sales_access')) and (select private.proposal_is_editable(proposal_id)));

drop policy "proposal items: sales add" on public.proposal_items;
drop policy "proposal items: sales update" on public.proposal_items;
drop policy "proposal items: sales delete" on public.proposal_items;
create policy "proposal items: sales add" on public.proposal_items
  for insert to authenticated
  with check (created_by = (select auth.uid()) and (select private.has_capability(organization_id, 'sales_access'))
              and (select private.proposal_is_editable(proposal_id)));
create policy "proposal items: sales update" on public.proposal_items
  for update to authenticated
  using ((select private.has_capability(organization_id, 'sales_access')) and (select private.proposal_is_editable(proposal_id)))
  with check ((select private.has_capability(organization_id, 'sales_access')) and (select private.proposal_is_editable(proposal_id)));
create policy "proposal items: sales delete" on public.proposal_items
  for delete to authenticated
  using ((select private.has_capability(organization_id, 'sales_access')) and (select private.proposal_is_editable(proposal_id)));

-- ---------------------------------------------------------------------------
-- 5. Reviews
-- ---------------------------------------------------------------------------

create table public.proposal_reviews (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null,
  organization_id uuid not null,
  version integer not null,
  reviewer_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  decision text not null check (decision in ('comment', 'changes_requested', 'approved')),
  comment text not null default '' check (char_length(comment) <= 4000),
  created_at timestamptz not null default now(),
  constraint proposal_reviews_proposal_fk foreign key (proposal_id, organization_id)
    references public.proposals (id, organization_id) on delete cascade,
  check (decision <> 'changes_requested' or char_length(trim(comment)) > 0)
);
create index proposal_reviews_proposal_idx on public.proposal_reviews (proposal_id, organization_id, created_at);
create index proposal_reviews_reviewer_idx on public.proposal_reviews (reviewer_id);

alter table public.proposal_reviews enable row level security;
create policy "proposal reviews: members read" on public.proposal_reviews
  for select to authenticated using ((select private.is_org_member(organization_id)));
create policy "proposal reviews: add" on public.proposal_reviews
  for insert to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and (
      (decision = 'comment'
        and ((select private.has_capability(organization_id, 'sales_access')) or (select private.is_org_manager(organization_id))))
      or (decision in ('approved', 'changes_requested') and (select private.is_org_manager(organization_id)))
    )
  );
revoke all on public.proposal_reviews from anon;
grant select, insert on public.proposal_reviews to authenticated;

-- A decision moves the proposal on (the workflow trigger checks the reviewer's rights again).
create or replace function private.proposal_reviews_apply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.decision = 'approved' then
    update public.proposals set status = 'approved_internally'
    where id = new.proposal_id and status = 'under_review';
    if not found then
      raise exception 'Only a proposal under review can be approved' using errcode = '22023';
    end if;
  elsif new.decision = 'changes_requested' then
    update public.proposals set status = 'changes_requested'
    where id = new.proposal_id and status = 'under_review';
    if not found then
      raise exception 'Changes can only be requested on a proposal under review' using errcode = '22023';
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function private.proposal_reviews_apply() from public, anon, authenticated;
create trigger proposal_reviews_apply after insert on public.proposal_reviews
  for each row execute function private.proposal_reviews_apply();

-- Proposals under review, approved or sent are locked: client-facing header fields cannot change
-- unless the proposal goes back to draft / changes requested (which also clears the approval).
create or replace function private.proposals_lock_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('under_review', 'approved_internally', 'sent_to_client', 'awaiting_response', 'accepted', 'converted', 'rejected', 'expired')
     and new.status is not distinct from old.status
     and (new.title, new.summary, new.brief, new.vat_rate, new.client_id, new.proposal_type, new.issue_date, new.due_date, new.valid_until)
         is distinct from
         (old.title, old.summary, old.brief, old.vat_rate, old.client_id, old.proposal_type, old.issue_date, old.due_date, old.valid_until) then
    raise exception 'This proposal is locked during review and after approval. Move it back to draft to edit it.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.proposals_lock_content() from public, anon, authenticated;
create trigger proposals_lock_content before update on public.proposals
  for each row execute function private.proposals_lock_content();

-- ---------------------------------------------------------------------------
-- 6. Proposal -> project conversion, in one transaction
-- ---------------------------------------------------------------------------

-- Runs as the caller (RLS applies to every row it reads or writes). Creates the project and its
-- BOQ from the proposal's client prices (internal costs are not copied), then marks the proposal
-- converted. The workflow trigger refuses the status change for an unapproved proposal unless
-- the caller is a manager, which rolls the whole conversion back. Calling it again returns the
-- project created the first time.
create or replace function public.convert_proposal_to_project(pid uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  p public.proposals;
  new_project uuid;
  subtotal numeric;
begin
  select * into p from public.proposals where id = pid for update;
  if p.id is null then
    raise exception 'Proposal not found or not editable by you' using errcode = '42501';
  end if;
  if p.project_id is not null then
    return p.project_id;
  end if;
  if p.status in ('rejected', 'expired') then
    raise exception 'A rejected or expired proposal cannot become a project' using errcode = '22023';
  end if;
  if p.approved_at is null and not private.is_org_manager(p.organization_id) then
    raise exception 'The proposal must be approved internally before it becomes a project' using errcode = '42501';
  end if;

  select coalesce(sum(i.quantity * i.unit_price) filter (where not i.is_optional), 0)
    into subtotal from public.proposal_items i where i.proposal_id = pid;

  insert into public.projects (organization_id, name, client_id, description, status, budget, created_by)
  values (p.organization_id, p.title, p.client_id, p.summary, 'confirmed', nullif(round(subtotal, 2), 0), (select auth.uid()))
  returning id into new_project;

  insert into public.boq_items (project_id, description, unit, quantity, unit_price, sort_order)
  select new_project, i.description, i.unit, i.quantity, i.unit_price,
         (row_number() over (order by i.sort_order, i.created_at) - 1)::integer
  from public.proposal_items i where i.proposal_id = pid;

  update public.proposals set status = 'converted', project_id = new_project where id = pid;
  return new_project;
end;
$$;
revoke execute on function public.convert_proposal_to_project(uuid) from public, anon;
grant execute on function public.convert_proposal_to_project(uuid) to authenticated;
