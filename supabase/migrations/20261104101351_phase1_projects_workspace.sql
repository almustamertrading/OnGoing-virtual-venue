-- Phase 1: the project becomes the central record.
-- events -> projects, plus organisations, clients, scope, milestones, tasks and an activity log.

-- ---------------------------------------------------------------------------
-- 1. Rename events to projects
-- ---------------------------------------------------------------------------

alter table public.events rename to projects;
alter table public.event_members rename to project_members;
alter type public.member_role rename to project_role;

alter table public.project_members rename column event_id to project_id;
alter table public.venues rename column event_id to project_id;
alter table public.layers rename column event_id to project_id;
alter table public.features rename column event_id to project_id;
alter table public.comments rename column event_id to project_id;
alter table public.panoramas rename column event_id to project_id;

alter index public.events_pkey rename to projects_pkey;
alter index public.events_created_by_idx rename to projects_created_by_idx;
alter index public.event_members_pkey rename to project_members_pkey;
alter index public.event_members_user_id_idx rename to project_members_user_id_idx;
alter index public.venues_event_id_idx rename to venues_project_id_idx;
alter index public.layers_event_id_idx rename to layers_project_id_idx;
alter index public.features_event_id_idx rename to features_project_id_idx;
alter index public.comments_event_id_idx rename to comments_project_id_idx;
alter index public.panoramas_event_id_idx rename to panoramas_project_id_idx;

alter trigger events_updated_at on public.projects rename to projects_updated_at;
alter trigger events_add_owner on public.projects rename to projects_add_owner;

alter table public.project_members add column responsibility text not null default '';

-- ---------------------------------------------------------------------------
-- 2. Organisations, with automatic membership by email domain
-- ---------------------------------------------------------------------------

create type public.org_role as enum ('admin', 'manager', 'staff');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  email_domain text unique check (email_domain = lower(email_domain)),
  currency text not null default 'SAR',
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_id_idx on public.organization_members (user_id);

insert into public.organizations (name, email_domain) values ('OnGoingEvent', 'ongoingevent.com');

-- ---------------------------------------------------------------------------
-- 3. Clients and richer projects
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  contact_name text,
  email text,
  phone text,
  notes text not null default '',
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index clients_organization_id_idx on public.clients (organization_id);
create index clients_created_by_idx on public.clients (created_by);
create trigger clients_updated_at before update on public.clients
  for each row execute function private.set_updated_at();

create type public.project_status as enum
  ('lead', 'proposal', 'confirmed', 'in_progress', 'completed', 'on_hold', 'cancelled');
create type public.project_type as enum
  ('sports_event', 'conference', 'exhibition', 'festival', 'corporate_event', 'production', 'other');

-- The table is empty at this point, so a NOT NULL column can be added directly.
alter table public.projects
  add column organization_id uuid not null references public.organizations (id) on delete cascade,
  add column client_id uuid,
  add column code text,
  add column status public.project_status not null default 'lead',
  add column project_type public.project_type not null default 'other',
  add column location text,
  add column budget numeric(14, 2) check (budget is null or budget >= 0),
  add constraint projects_client_fk foreign key (client_id, organization_id)
    references public.clients (id, organization_id),
  add constraint projects_code_unique unique (organization_id, code);
create index projects_organization_id_idx on public.projects (organization_id);
create index projects_client_idx on public.projects (client_id, organization_id);

-- Project codes look like 2027-014: the start year (or this year) and a running number.
create or replace function private.set_project_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  yr text := to_char(coalesce(new.start_date, current_date), 'YYYY');
  n int;
begin
  if new.code is not null and new.code <> '' then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext(new.organization_id::text || yr));
  select coalesce(max(split_part(p.code, '-', 2)::int), 0) + 1 into n
  from public.projects p
  where p.organization_id = new.organization_id
    and p.code ~ ('^' || yr || '-[0-9]+$');
  new.code := yr || '-' || lpad(n::text, 3, '0');
  return new;
end;
$$;
create trigger projects_set_code before insert on public.projects
  for each row execute function private.set_project_code();

-- ---------------------------------------------------------------------------
-- 4. Scope, milestones and tasks
-- ---------------------------------------------------------------------------

create type public.scope_kind as enum ('scope', 'deliverable');
create type public.work_status as enum ('planned', 'in_progress', 'done');
create type public.task_status as enum ('todo', 'in_progress', 'blocked', 'done');
create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');

create table public.scope_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind public.scope_kind not null default 'scope',
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '',
  status public.work_status not null default 'planned',
  due_date date,
  sort_order double precision not null default 0,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id)
);
create index scope_items_project_id_idx on public.scope_items (project_id);
create index scope_items_created_by_idx on public.scope_items (created_by);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  due_date date,
  done boolean not null default false,
  sort_order double precision not null default 0,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id)
);
create index milestones_project_id_idx on public.milestones (project_id);
create index milestones_created_by_idx on public.milestones (created_by);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '',
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'normal',
  assignee_id uuid references auth.users (id) on delete set null,
  due_date date,
  milestone_id uuid references public.milestones (id) on delete set null,
  scope_item_id uuid references public.scope_items (id) on delete set null,
  sort_order double precision not null default 0,
  completed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_project_id_idx on public.tasks (project_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);
create index tasks_milestone_id_idx on public.tasks (milestone_id);
create index tasks_scope_item_id_idx on public.tasks (scope_item_id);
create index tasks_created_by_idx on public.tasks (created_by);

create trigger scope_items_updated_at before update on public.scope_items
  for each row execute function private.set_updated_at();
create trigger milestones_updated_at before update on public.milestones
  for each row execute function private.set_updated_at();

-- Tasks: keep completed_at in step with status, and keep links inside the same project.
create or replace function private.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  if new.milestone_id is not null and not exists (
    select 1 from public.milestones m where m.id = new.milestone_id and m.project_id = new.project_id
  ) then
    raise exception 'Milestone belongs to another project' using errcode = '23503';
  end if;
  if new.scope_item_id is not null and not exists (
    select 1 from public.scope_items s where s.id = new.scope_item_id and s.project_id = new.project_id
  ) then
    raise exception 'Scope item belongs to another project' using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger tasks_before_write before insert or update on public.tasks
  for each row execute function private.tasks_before_write();

-- ---------------------------------------------------------------------------
-- 5. Access helpers (recreated for the renamed tables)
-- Organisation admins see and edit every project in their organisation.
-- ---------------------------------------------------------------------------

create or replace function private.is_org_member(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = oid and om.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_org_admin(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = oid and om.user_id = (select auth.uid()) and om.role = 'admin'
  );
$$;

create or replace function private.is_org_manager(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = oid and om.user_id = (select auth.uid()) and om.role in ('admin', 'manager')
  );
$$;

create or replace function private.event_role(eid uuid)
returns public.project_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.project_members m
  where m.project_id = eid and m.user_id = (select auth.uid());
$$;

create or replace function private.is_member(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = eid and m.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = eid and om.user_id = (select auth.uid()) and om.role = 'admin'
  );
$$;

create or replace function private.can_edit(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = eid and m.user_id = (select auth.uid()) and m.role in ('owner', 'editor')
  ) or exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = eid and om.user_id = (select auth.uid()) and om.role = 'admin'
  );
$$;

create or replace function private.is_owner(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = eid and m.user_id = (select auth.uid()) and m.role = 'owner'
  ) or exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = eid and om.user_id = (select auth.uid()) and om.role = 'admin'
  );
$$;

create or replace function private.shares_event(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members mine
    join public.project_members theirs on theirs.project_id = mine.project_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other
  ) or exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other
  );
$$;

revoke execute on function private.is_org_member(uuid), private.is_org_admin(uuid),
  private.is_org_manager(uuid) from public, anon;
grant execute on function private.is_org_member(uuid), private.is_org_admin(uuid),
  private.is_org_manager(uuid) to authenticated;

-- The creator of a project becomes its owner.
create or replace function private.add_event_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (project_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

-- New users join the organisation that owns their email domain; the first one is its admin.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  domain text := lower(split_part(coalesce(new.email, ''), '@', 2));
  org uuid;
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), '')
  )
  on conflict (id) do update set email = excluded.email;

  if domain <> '' then
    select o.id into org from public.organizations o where o.email_domain = domain;
    if org is not null then
      insert into public.organization_members (organization_id, user_id, role)
      values (
        org,
        new.id,
        case when exists (select 1 from public.organization_members x where x.organization_id = org)
             then 'staff'::public.org_role else 'admin'::public.org_role end
      )
      on conflict (organization_id, user_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

-- Owners add an existing user to a project by email.
create or replace function private.add_member_by_email(eid uuid, member_email text, member_role public.project_role)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not (select private.is_owner(eid)) then
    raise exception 'Only project owners can add members' using errcode = '42501';
  end if;

  select p.id into target from public.profiles p where lower(p.email) = lower(trim(member_email));
  if target is null then
    raise exception 'No account found for %. Ask them to sign up first.', member_email using errcode = 'P0002';
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (eid, target, member_role)
  on conflict (project_id, user_id) do update set role = excluded.role;
  return target;
end;
$$;

-- Organisation members who signed up before this migration join by domain now.
insert into public.organization_members (organization_id, user_id, role)
select o.id, u.id, 'staff'
from auth.users u
join public.organizations o on o.email_domain = lower(split_part(u.email, '@', 2))
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 6. Activity log, written by triggers only
-- ---------------------------------------------------------------------------

create table public.activity (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_project_created_idx on public.activity (project_id, created_at desc);
create index activity_actor_id_idx on public.activity (actor_id);

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

  label := coalesce(rec ->> 'title', rec ->> 'name', rec ->> 'body', '');
  info := jsonb_build_object('label', left(label, 140));
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
revoke execute on function private.log_activity(), private.set_project_code(), private.tasks_before_write()
  from public, anon, authenticated;

create trigger projects_activity after insert or update on public.projects
  for each row execute function private.log_activity();
create trigger scope_items_activity after insert or update or delete on public.scope_items
  for each row execute function private.log_activity();
create trigger milestones_activity after insert or update or delete on public.milestones
  for each row execute function private.log_activity();
create trigger tasks_activity after insert or update or delete on public.tasks
  for each row execute function private.log_activity();
create trigger project_members_activity after insert or update or delete on public.project_members
  for each row execute function private.log_activity();
create trigger venues_activity after insert or update or delete on public.venues
  for each row execute function private.log_activity();
create trigger layers_activity after insert or delete on public.layers
  for each row execute function private.log_activity();
create trigger features_activity after insert or update or delete on public.features
  for each row execute function private.log_activity();
create trigger comments_activity after insert on public.comments
  for each row execute function private.log_activity();
create trigger panoramas_activity after insert or delete on public.panoramas
  for each row execute function private.log_activity();

-- ---------------------------------------------------------------------------
-- 7. Row level security for the new and changed tables
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.clients enable row level security;
alter table public.scope_items enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.activity enable row level security;

create policy "organizations: members read" on public.organizations
  for select to authenticated using ((select private.is_org_member(id)));
create policy "organizations: admins update" on public.organizations
  for update to authenticated
  using ((select private.is_org_admin(id))) with check ((select private.is_org_admin(id)));

create policy "org members: members read" on public.organization_members
  for select to authenticated using ((select private.is_org_member(organization_id)));
create policy "org members: admins add" on public.organization_members
  for insert to authenticated with check ((select private.is_org_admin(organization_id)));
create policy "org members: admins change roles" on public.organization_members
  for update to authenticated
  using ((select private.is_org_admin(organization_id)))
  with check ((select private.is_org_admin(organization_id)));
create policy "org members: admins remove" on public.organization_members
  for delete to authenticated using ((select private.is_org_admin(organization_id)));

create policy "clients: org members read" on public.clients
  for select to authenticated using ((select private.is_org_member(organization_id)));
create policy "clients: org members add" on public.clients
  for insert to authenticated
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));
create policy "clients: org members update" on public.clients
  for update to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)));
create policy "clients: managers delete" on public.clients
  for delete to authenticated using ((select private.is_org_manager(organization_id)));

-- Projects are created inside an organisation the user belongs to.
drop policy "events: signed-in users create" on public.projects;
create policy "projects: org members create" on public.projects
  for insert to authenticated
  with check (created_by = (select auth.uid()) and (select private.is_org_member(organization_id)));
alter policy "events: members read" on public.projects rename to "projects: members read";
alter policy "events: owners update" on public.projects rename to "projects: owners update";
alter policy "events: owners delete" on public.projects rename to "projects: owners delete";

create policy "scope: members read" on public.scope_items
  for select to authenticated using ((select private.is_member(project_id)));
create policy "scope: editors insert" on public.scope_items
  for insert to authenticated with check ((select private.can_edit(project_id)));
create policy "scope: editors update" on public.scope_items
  for update to authenticated
  using ((select private.can_edit(project_id))) with check ((select private.can_edit(project_id)));
create policy "scope: editors delete" on public.scope_items
  for delete to authenticated using ((select private.can_edit(project_id)));

create policy "milestones: members read" on public.milestones
  for select to authenticated using ((select private.is_member(project_id)));
create policy "milestones: editors insert" on public.milestones
  for insert to authenticated with check ((select private.can_edit(project_id)));
create policy "milestones: editors update" on public.milestones
  for update to authenticated
  using ((select private.can_edit(project_id))) with check ((select private.can_edit(project_id)));
create policy "milestones: editors delete" on public.milestones
  for delete to authenticated using ((select private.can_edit(project_id)));

-- Assignees may update their own tasks (for example, to mark them done) even as viewers.
create policy "tasks: members read" on public.tasks
  for select to authenticated using ((select private.is_member(project_id)));
create policy "tasks: editors insert" on public.tasks
  for insert to authenticated with check ((select private.can_edit(project_id)));
create policy "tasks: editors or assignee update" on public.tasks
  for update to authenticated
  using ((select private.can_edit(project_id))
         or (assignee_id = (select auth.uid()) and (select private.is_member(project_id))))
  with check ((select private.can_edit(project_id))
              or (assignee_id = (select auth.uid()) and (select private.is_member(project_id))));
create policy "tasks: editors delete" on public.tasks
  for delete to authenticated using ((select private.can_edit(project_id)));

create policy "activity: members read" on public.activity
  for select to authenticated using ((select private.is_member(project_id)));

revoke all on public.organizations, public.organization_members, public.clients, public.scope_items,
  public.milestones, public.tasks, public.activity from anon;
grant select, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members, public.clients, public.scope_items,
  public.milestones, public.tasks to authenticated;
grant select on public.activity to authenticated;

-- Live updates for the workspace.
alter publication supabase_realtime add table public.tasks, public.milestones, public.scope_items, public.activity;
alter table public.tasks replica identity full;
alter table public.milestones replica identity full;
alter table public.scope_items replica identity full;
