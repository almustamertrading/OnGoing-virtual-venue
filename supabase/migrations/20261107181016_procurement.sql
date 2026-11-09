-- Procurement (Planner): an organisation-wide supplier directory, per-project
-- requests for quotation (RFQs), and the quotes suppliers give against them.

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  category text not null default '',
  contact_name text,
  email text,
  phone text,
  rating integer not null default 0 check (rating between 0 and 5),
  notes text not null default '',
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index suppliers_organization_id_idx on public.suppliers (organization_id);
create index suppliers_created_by_idx on public.suppliers (created_by);
create trigger suppliers_updated_at before update on public.suppliers
  for each row execute function private.set_updated_at();

create type public.rfq_status as enum ('draft', 'sent', 'awarded', 'closed');
create type public.quote_status as enum ('pending', 'received', 'accepted', 'rejected');

create table public.rfqs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '',
  category text not null default '',
  status public.rfq_status not null default 'draft',
  due_date date,
  sort_order double precision not null default 0,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id)
);
create index rfqs_project_id_idx on public.rfqs (project_id);
create index rfqs_created_by_idx on public.rfqs (created_by);
create trigger rfqs_updated_at before update on public.rfqs
  for each row execute function private.set_updated_at();

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete set null,
  supplier_name text not null default '',
  amount numeric(14, 2) check (amount is null or amount >= 0),
  notes text not null default '',
  status public.quote_status not null default 'received',
  sort_order double precision not null default 0,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotes_rfq_id_idx on public.quotes (rfq_id);
create index quotes_project_id_idx on public.quotes (project_id);
create index quotes_supplier_id_idx on public.quotes (supplier_id);
create index quotes_created_by_idx on public.quotes (created_by);
create trigger quotes_updated_at before update on public.quotes
  for each row execute function private.set_updated_at();

-- Activity log (RFQs and quotes are project-scoped; suppliers are org-level).
create trigger rfqs_activity after insert or update or delete on public.rfqs
  for each row execute function private.log_activity();
create trigger quotes_activity after insert or update or delete on public.quotes
  for each row execute function private.log_activity();

-- RLS.
alter table public.suppliers enable row level security;
alter table public.rfqs enable row level security;
alter table public.quotes enable row level security;

create policy "suppliers: org members read" on public.suppliers
  for select to authenticated using ((select private.is_org_member(organization_id)));
create policy "suppliers: org members add" on public.suppliers
  for insert to authenticated
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));
create policy "suppliers: org members update" on public.suppliers
  for update to authenticated
  using ((select private.is_org_member(organization_id))) with check ((select private.is_org_member(organization_id)));
create policy "suppliers: managers delete" on public.suppliers
  for delete to authenticated using ((select private.is_org_manager(organization_id)));

create policy "rfqs: members read" on public.rfqs
  for select to authenticated using ((select private.is_member(project_id)));
create policy "rfqs: editors insert" on public.rfqs
  for insert to authenticated with check ((select private.can_edit(project_id)));
create policy "rfqs: editors update" on public.rfqs
  for update to authenticated
  using ((select private.can_edit(project_id))) with check ((select private.can_edit(project_id)));
create policy "rfqs: editors delete" on public.rfqs
  for delete to authenticated using ((select private.can_edit(project_id)));

create policy "quotes: members read" on public.quotes
  for select to authenticated using ((select private.is_member(project_id)));
create policy "quotes: editors insert" on public.quotes
  for insert to authenticated with check ((select private.can_edit(project_id)));
create policy "quotes: editors update" on public.quotes
  for update to authenticated
  using ((select private.can_edit(project_id))) with check ((select private.can_edit(project_id)));
create policy "quotes: editors delete" on public.quotes
  for delete to authenticated using ((select private.can_edit(project_id)));

revoke all on public.suppliers, public.rfqs, public.quotes from anon;
grant select, insert, update, delete on public.suppliers, public.rfqs, public.quotes to authenticated;

alter publication supabase_realtime add table public.suppliers, public.rfqs, public.quotes;
alter table public.suppliers replica identity full;
alter table public.rfqs replica identity full;
alter table public.quotes replica identity full;
