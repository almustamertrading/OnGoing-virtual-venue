-- Richer RFP intake: bill of quantities (pricing), evaluation criteria (KPIs),
-- and submission/reference metadata pulled from the tender document.
-- Project timelines reuse the existing `milestones` table.

-- 1. Submission + reference metadata on the project, address on the client.
alter table public.projects
  add column rfp_reference text,
  add column submission_method text,
  add column submission_location text,
  add column submission_deadline text;

alter table public.clients add column address text;

-- 2. Bill of quantities / pricing model (جدول الكميات / نموذج التسعير).
-- Quantities come from the RFP; the team fills unit prices later.
create table public.boq_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 500),
  unit text not null default '',
  quantity numeric(14, 2),
  unit_price numeric(14, 2) check (unit_price is null or unit_price >= 0),
  notes text not null default '',
  sort_order double precision not null default 0,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id)
);
create index boq_items_project_id_idx on public.boq_items (project_id);
create index boq_items_created_by_idx on public.boq_items (created_by);
create trigger boq_items_updated_at before update on public.boq_items
  for each row execute function private.set_updated_at();

-- 3. Evaluation criteria / KPIs (معايير التقييم) — mandatory verification.
create table public.evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  criterion text not null check (char_length(criterion) between 1 and 500),
  weight numeric(6, 2) check (weight is null or weight >= 0),
  met boolean not null default false,
  evidence text not null default '',
  sort_order double precision not null default 0,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id)
);
create index evaluation_criteria_project_id_idx on public.evaluation_criteria (project_id);
create index evaluation_criteria_created_by_idx on public.evaluation_criteria (created_by);
create trigger evaluation_criteria_updated_at before update on public.evaluation_criteria
  for each row execute function private.set_updated_at();

-- 4. Project management plan — phases with objectives and dates (خطة إدارة المشروع).
create table public.plan_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  objective text not null default '',
  start_date date,
  end_date date,
  sort_order double precision not null default 0,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id)
);
create index plan_phases_project_id_idx on public.plan_phases (project_id);
create index plan_phases_created_by_idx on public.plan_phases (created_by);
create trigger plan_phases_updated_at before update on public.plan_phases
  for each row execute function private.set_updated_at();

-- 5. Proposed team structure — roles, responsibilities and headcount (هيكل فريق العمل).
create table public.team_roles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  responsibility text not null default '',
  headcount integer not null default 1 check (headcount between 0 and 100000),
  reports_to text not null default '',
  assignee_id uuid references auth.users (id) on delete set null,
  sort_order double precision not null default 0,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id)
);
create index team_roles_project_id_idx on public.team_roles (project_id);
create index team_roles_created_by_idx on public.team_roles (created_by);
create trigger team_roles_updated_at before update on public.team_roles
  for each row execute function private.set_updated_at();

-- 6. Activity log triggers (same function as the other tables).
create trigger boq_items_activity after insert or update or delete on public.boq_items
  for each row execute function private.log_activity();
create trigger evaluation_criteria_activity after insert or update or delete on public.evaluation_criteria
  for each row execute function private.log_activity();
create trigger plan_phases_activity after insert or update or delete on public.plan_phases
  for each row execute function private.log_activity();
create trigger team_roles_activity after insert or update or delete on public.team_roles
  for each row execute function private.log_activity();

-- 7. Row level security: members read, editors write (mirrors scope_items).
alter table public.boq_items enable row level security;
alter table public.evaluation_criteria enable row level security;
alter table public.plan_phases enable row level security;
alter table public.team_roles enable row level security;

create policy "boq: members read" on public.boq_items
  for select to authenticated using ((select private.is_member(project_id)));
create policy "boq: editors insert" on public.boq_items
  for insert to authenticated with check ((select private.can_edit(project_id)));
create policy "boq: editors update" on public.boq_items
  for update to authenticated
  using ((select private.can_edit(project_id))) with check ((select private.can_edit(project_id)));
create policy "boq: editors delete" on public.boq_items
  for delete to authenticated using ((select private.can_edit(project_id)));

create policy "kpi: members read" on public.evaluation_criteria
  for select to authenticated using ((select private.is_member(project_id)));
create policy "kpi: editors insert" on public.evaluation_criteria
  for insert to authenticated with check ((select private.can_edit(project_id)));
create policy "kpi: editors update" on public.evaluation_criteria
  for update to authenticated
  using ((select private.can_edit(project_id))) with check ((select private.can_edit(project_id)));
create policy "kpi: editors delete" on public.evaluation_criteria
  for delete to authenticated using ((select private.can_edit(project_id)));

create policy "plan: members read" on public.plan_phases
  for select to authenticated using ((select private.is_member(project_id)));
create policy "plan: editors insert" on public.plan_phases
  for insert to authenticated with check ((select private.can_edit(project_id)));
create policy "plan: editors update" on public.plan_phases
  for update to authenticated
  using ((select private.can_edit(project_id))) with check ((select private.can_edit(project_id)));
create policy "plan: editors delete" on public.plan_phases
  for delete to authenticated using ((select private.can_edit(project_id)));

create policy "team roles: members read" on public.team_roles
  for select to authenticated using ((select private.is_member(project_id)));
create policy "team roles: editors insert" on public.team_roles
  for insert to authenticated with check ((select private.can_edit(project_id)));
create policy "team roles: editors update" on public.team_roles
  for update to authenticated
  using ((select private.can_edit(project_id))) with check ((select private.can_edit(project_id)));
create policy "team roles: editors delete" on public.team_roles
  for delete to authenticated using ((select private.can_edit(project_id)));

revoke all on public.boq_items, public.evaluation_criteria, public.plan_phases, public.team_roles from anon;
grant select, insert, update, delete
  on public.boq_items, public.evaluation_criteria, public.plan_phases, public.team_roles to authenticated;

-- 8. Live updates for the workspace.
alter publication supabase_realtime add table
  public.boq_items, public.evaluation_criteria, public.plan_phases, public.team_roles;
alter table public.boq_items replica identity full;
alter table public.evaluation_criteria replica identity full;
alter table public.plan_phases replica identity full;
alter table public.team_roles replica identity full;
