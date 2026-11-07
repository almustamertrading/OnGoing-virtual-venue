-- Business/Ops: an organisation inventory register, plus per-project invoices
-- and expenses for cost and cash tracking against the budget.

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  category text not null default '',
  unit text not null default '',
  quantity numeric(14, 2) not null default 0,
  unit_rate numeric(14, 2) check (unit_rate is null or unit_rate >= 0),
  notes text not null default '',
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index inventory_items_organization_id_idx on public.inventory_items (organization_id);
create index inventory_items_created_by_idx on public.inventory_items (created_by);
create trigger inventory_items_updated_at before update on public.inventory_items
  for each row execute function private.set_updated_at();

create type public.invoice_status as enum ('draft', 'sent', 'paid');

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  number text not null default '',
  title text not null default '',
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  status public.invoice_status not null default 'draft',
  issue_date date,
  due_date date,
  sort_order double precision not null default 0,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id)
);
create index invoices_project_id_idx on public.invoices (project_id);
create index invoices_created_by_idx on public.invoices (created_by);
create trigger invoices_updated_at before update on public.invoices
  for each row execute function private.set_updated_at();

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 300),
  category text not null default '',
  vendor text not null default '',
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  incurred_on date,
  sort_order double precision not null default 0,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id)
);
create index expenses_project_id_idx on public.expenses (project_id);
create index expenses_created_by_idx on public.expenses (created_by);
create trigger expenses_updated_at before update on public.expenses
  for each row execute function private.set_updated_at();

-- Activity (project-scoped tables only).
create trigger invoices_activity after insert or update or delete on public.invoices
  for each row execute function private.log_activity();
create trigger expenses_activity after insert or update or delete on public.expenses
  for each row execute function private.log_activity();

-- RLS.
alter table public.inventory_items enable row level security;
alter table public.invoices enable row level security;
alter table public.expenses enable row level security;

create policy "inventory: org members read" on public.inventory_items
  for select to authenticated using ((select private.is_org_member(organization_id)));
create policy "inventory: org members add" on public.inventory_items
  for insert to authenticated
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));
create policy "inventory: org members update" on public.inventory_items
  for update to authenticated
  using ((select private.is_org_member(organization_id))) with check ((select private.is_org_member(organization_id)));
create policy "inventory: managers delete" on public.inventory_items
  for delete to authenticated using ((select private.is_org_manager(organization_id)));

create policy "invoices: members read" on public.invoices
  for select to authenticated using ((select private.is_member(project_id)));
create policy "invoices: editors insert" on public.invoices
  for insert to authenticated with check ((select private.can_edit(project_id)));
create policy "invoices: editors update" on public.invoices
  for update to authenticated
  using ((select private.can_edit(project_id))) with check ((select private.can_edit(project_id)));
create policy "invoices: editors delete" on public.invoices
  for delete to authenticated using ((select private.can_edit(project_id)));

create policy "expenses: members read" on public.expenses
  for select to authenticated using ((select private.is_member(project_id)));
create policy "expenses: editors insert" on public.expenses
  for insert to authenticated with check ((select private.can_edit(project_id)));
create policy "expenses: editors update" on public.expenses
  for update to authenticated
  using ((select private.can_edit(project_id))) with check ((select private.can_edit(project_id)));
create policy "expenses: editors delete" on public.expenses
  for delete to authenticated using ((select private.can_edit(project_id)));

revoke all on public.inventory_items, public.invoices, public.expenses from anon;
grant select, insert, update, delete on public.inventory_items, public.invoices, public.expenses to authenticated;

alter publication supabase_realtime add table public.inventory_items, public.invoices, public.expenses;
alter table public.inventory_items replica identity full;
alter table public.invoices replica identity full;
alter table public.expenses replica identity full;
