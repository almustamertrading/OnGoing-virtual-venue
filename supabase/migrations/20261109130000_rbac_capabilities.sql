-- Capability-based access control with database-enforced financial confidentiality
-- (Phase 2, Stage 1). See docs/ROLE_PERMISSION_MATRIX.md.
--
-- Until the business approves a final role policy, internal costs, margins, expenses,
-- supplier quotes, invoices and inventory valuation are visible only to organisation
-- admins and to members explicitly given finance_access.
--
-- Expand phase: internal-cost columns move to finance-only side tables
-- (proposal_item_costs, inventory_item_costs). The old columns stay for one release so
-- the previously deployed app keeps working; triggers move any value written to them
-- into the side tables and blank the old column, so they never hold real data again.
-- A later contract migration drops the old columns and triggers.
--
-- Rollback (before the contract migration), as one transaction:
--   update public.proposal_items i set unit_cost = c.unit_cost
--     from public.proposal_item_costs c where c.item_id = i.id;
--   update public.inventory_items i set unit_rate = c.unit_rate
--     from public.inventory_item_costs c where c.item_id = i.id;
--   then restore the previous policies from migrations 20261107090000,
--   20261107110000, 20261109090000 and 20261109120000.

-- ---------------------------------------------------------------------------
-- 1. Capabilities
-- ---------------------------------------------------------------------------

create type public.capability as enum (
  'organization_admin', 'project_manager', 'finance_access',
  'sales_access', 'operations_access', 'viewer_access'
);

alter table public.organization_members
  add column capabilities public.capability[] not null default '{}',
  add constraint organization_members_admin_capability_is_role
    check (not ('organization_admin' = any (capabilities)));

comment on column public.organization_members.capabilities is
  'Extra permissions. organization_admin is not stored here: it is the admin role, and admins hold every capability.';

-- Managers keep what they could do before, except finance (least privilege).
-- Staff start as viewers; an admin grants more.
update public.organization_members
set capabilities = '{project_manager,sales_access,operations_access}'
where role = 'manager';

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------

create or replace function private.has_capability(oid uuid, cap public.capability)
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
      and (om.role = 'admin' or cap = any (om.capabilities))
  );
$$;

-- Finance records of a project: project members (or org admins) holding finance_access.
create or replace function private.can_access_project_finance(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_member(pid) and exists (
    select 1
    from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = pid
      and om.user_id = (select auth.uid())
      and (om.role = 'admin' or 'finance_access' = any (om.capabilities))
  );
$$;

revoke execute on function private.has_capability(uuid, public.capability),
  private.can_access_project_finance(uuid) from public, anon;
grant execute on function private.has_capability(uuid, public.capability),
  private.can_access_project_finance(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Finance-only project records: invoices, expenses, supplier quotes
-- ---------------------------------------------------------------------------

drop policy "invoices: members read" on public.invoices;
drop policy "invoices: editors insert" on public.invoices;
drop policy "invoices: editors update" on public.invoices;
drop policy "invoices: editors delete" on public.invoices;
create policy "invoices: finance read" on public.invoices
  for select to authenticated using ((select private.can_access_project_finance(project_id)));
create policy "invoices: finance insert" on public.invoices
  for insert to authenticated with check ((select private.can_access_project_finance(project_id)));
create policy "invoices: finance update" on public.invoices
  for update to authenticated
  using ((select private.can_access_project_finance(project_id)))
  with check ((select private.can_access_project_finance(project_id)));
create policy "invoices: finance delete" on public.invoices
  for delete to authenticated using ((select private.can_access_project_finance(project_id)));

drop policy "expenses: members read" on public.expenses;
drop policy "expenses: editors insert" on public.expenses;
drop policy "expenses: editors update" on public.expenses;
drop policy "expenses: editors delete" on public.expenses;
create policy "expenses: finance read" on public.expenses
  for select to authenticated using ((select private.can_access_project_finance(project_id)));
create policy "expenses: finance insert" on public.expenses
  for insert to authenticated with check ((select private.can_access_project_finance(project_id)));
create policy "expenses: finance update" on public.expenses
  for update to authenticated
  using ((select private.can_access_project_finance(project_id)))
  with check ((select private.can_access_project_finance(project_id)));
create policy "expenses: finance delete" on public.expenses
  for delete to authenticated using ((select private.can_access_project_finance(project_id)));

drop policy "quotes: members read" on public.quotes;
drop policy "quotes: editors insert" on public.quotes;
drop policy "quotes: editors update" on public.quotes;
drop policy "quotes: editors delete" on public.quotes;
create policy "quotes: finance read" on public.quotes
  for select to authenticated using ((select private.can_access_project_finance(project_id)));
create policy "quotes: finance insert" on public.quotes
  for insert to authenticated with check ((select private.can_access_project_finance(project_id)));
create policy "quotes: finance update" on public.quotes
  for update to authenticated
  using ((select private.can_access_project_finance(project_id)))
  with check ((select private.can_access_project_finance(project_id)));
create policy "quotes: finance delete" on public.quotes
  for delete to authenticated using ((select private.can_access_project_finance(project_id)));

-- Activity lines about finance records follow the same rule (they carry titles).
drop policy "activity: members read" on public.activity;
create policy "activity: members read" on public.activity
  for select to authenticated
  using (
    (select private.is_member(project_id))
    and (
      entity_type not in ('invoices', 'expenses', 'quotes')
      or (select private.can_access_project_finance(project_id))
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Internal costs move to finance-only tables
-- ---------------------------------------------------------------------------

-- 4a. Side tables, protected from the moment they exist.
alter table public.proposal_items
  add constraint proposal_items_id_org_key unique (id, organization_id);

-- Proposal item costs (the margin is derived from these).
create table public.proposal_item_costs (
  item_id uuid not null,
  organization_id uuid not null,
  unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (item_id, organization_id),
  -- Deferred so the move trigger below can write the cost before the item row exists.
  constraint proposal_item_costs_item_fk foreign key (item_id, organization_id)
    references public.proposal_items (id, organization_id) on delete cascade
    deferrable initially deferred
);
create index proposal_item_costs_updated_by_idx on public.proposal_item_costs (updated_by);

-- Inventory valuation (unit rate).
create table public.inventory_item_costs (
  item_id uuid not null,
  organization_id uuid not null,
  unit_rate numeric(14, 2) not null check (unit_rate >= 0),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (item_id, organization_id),
  constraint inventory_item_costs_item_fk foreign key (item_id, organization_id)
    references public.inventory_items (id, organization_id) on delete cascade
    deferrable initially deferred
);
create index inventory_item_costs_updated_by_idx on public.inventory_item_costs (updated_by);

alter table public.proposal_item_costs enable row level security;
alter table public.inventory_item_costs enable row level security;

create policy "proposal item costs: finance read" on public.proposal_item_costs
  for select to authenticated using ((select private.has_capability(organization_id, 'finance_access')));
create policy "proposal item costs: finance add" on public.proposal_item_costs
  for insert to authenticated with check ((select private.has_capability(organization_id, 'finance_access')));
create policy "proposal item costs: finance update" on public.proposal_item_costs
  for update to authenticated
  using ((select private.has_capability(organization_id, 'finance_access')))
  with check ((select private.has_capability(organization_id, 'finance_access')));
create policy "proposal item costs: finance delete" on public.proposal_item_costs
  for delete to authenticated using ((select private.has_capability(organization_id, 'finance_access')));

create policy "inventory costs: finance read" on public.inventory_item_costs
  for select to authenticated using ((select private.has_capability(organization_id, 'finance_access')));
create policy "inventory costs: finance add" on public.inventory_item_costs
  for insert to authenticated with check ((select private.has_capability(organization_id, 'finance_access')));
create policy "inventory costs: finance update" on public.inventory_item_costs
  for update to authenticated
  using ((select private.has_capability(organization_id, 'finance_access')))
  with check ((select private.has_capability(organization_id, 'finance_access')));
create policy "inventory costs: finance delete" on public.inventory_item_costs
  for delete to authenticated using ((select private.has_capability(organization_id, 'finance_access')));

revoke all on public.proposal_item_costs, public.inventory_item_costs from anon;
grant select, insert, update, delete on public.proposal_item_costs, public.inventory_item_costs to authenticated;

-- 4b. Copy the values, then check the foreign keys now rather than at commit.
insert into public.proposal_item_costs (item_id, organization_id, unit_cost, updated_by, updated_at)
select id, organization_id, unit_cost, null, updated_at
from public.proposal_items
where unit_cost <> 0;

insert into public.inventory_item_costs (item_id, organization_id, unit_rate, updated_by, updated_at)
select id, organization_id, unit_rate, null, updated_at
from public.inventory_items
where unit_rate is not null;

set constraints public.proposal_item_costs_item_fk, public.inventory_item_costs_item_fk immediate;

-- 4c. Verify the copies before blanking the old columns.
do $$
declare
  src numeric;
  dst numeric;
  src_n bigint;
  dst_n bigint;
begin
  select coalesce(sum(unit_cost), 0), count(*) filter (where unit_cost <> 0) into src, src_n from public.proposal_items;
  select coalesce(sum(unit_cost), 0), count(*) into dst, dst_n from public.proposal_item_costs;
  if src <> dst or src_n <> dst_n then
    raise exception 'proposal cost copy mismatch: % rows / % vs % rows / %', src_n, src, dst_n, dst;
  end if;

  select coalesce(sum(unit_rate), 0), count(unit_rate) into src, src_n from public.inventory_items;
  select coalesce(sum(unit_rate), 0), count(*) into dst, dst_n from public.inventory_item_costs;
  if src <> dst or src_n <> dst_n then
    raise exception 'inventory rate copy mismatch: % rows / % vs % rows / %', src_n, src, dst_n, dst;
  end if;
end $$;

-- 4d. Blank the old columns (keeping each row's updated_at).
alter table public.proposal_items disable trigger proposal_items_updated_at;
update public.proposal_items set unit_cost = 0 where unit_cost <> 0;
alter table public.proposal_items enable trigger proposal_items_updated_at;

alter table public.inventory_items disable trigger inventory_items_updated_at;
update public.inventory_items set unit_rate = null where unit_rate is not null;
alter table public.inventory_items enable trigger inventory_items_updated_at;

-- 4e. Any later write to an old column is moved (finance users) or discarded (others).
create or replace function private.proposal_items_move_cost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.unit_cost is distinct from 0 then
    if (select private.has_capability(new.organization_id, 'finance_access')) then
      insert into public.proposal_item_costs (item_id, organization_id, unit_cost)
      values (new.id, new.organization_id, new.unit_cost)
      on conflict (item_id, organization_id) do update
        set unit_cost = excluded.unit_cost, updated_at = now(), updated_by = (select auth.uid());
    end if;
    new.unit_cost := 0;
  end if;
  return new;
end;
$$;

create or replace function private.inventory_items_move_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.unit_rate is not null then
    if (select private.has_capability(new.organization_id, 'finance_access')) then
      insert into public.inventory_item_costs (item_id, organization_id, unit_rate)
      values (new.id, new.organization_id, new.unit_rate)
      on conflict (item_id, organization_id) do update
        set unit_rate = excluded.unit_rate, updated_at = now(), updated_by = (select auth.uid());
    end if;
    new.unit_rate := null;
  end if;
  return new;
end;
$$;

revoke execute on function private.proposal_items_move_cost(), private.inventory_items_move_rate()
  from public, anon, authenticated;
create trigger proposal_items_move_cost before insert or update of unit_cost on public.proposal_items
  for each row execute function private.proposal_items_move_cost();
create trigger inventory_items_move_rate before insert or update of unit_rate on public.inventory_items
  for each row execute function private.inventory_items_move_rate();

-- ---------------------------------------------------------------------------
-- 5. Who may create and change records
-- ---------------------------------------------------------------------------

-- Projects (including leads): project managers and sales.
drop policy "projects: org members create" on public.projects;
create policy "projects: managers and sales create" on public.projects
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (select private.has_capability(organization_id, 'project_manager'))
      or (select private.has_capability(organization_id, 'sales_access'))
    )
  );

-- Clients: project managers and sales.
drop policy "clients: org members add" on public.clients;
drop policy "clients: org members update" on public.clients;
create policy "clients: managers and sales add" on public.clients
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (select private.has_capability(organization_id, 'project_manager'))
      or (select private.has_capability(organization_id, 'sales_access'))
    )
  );
create policy "clients: managers and sales update" on public.clients
  for update to authenticated
  using (
    (select private.has_capability(organization_id, 'project_manager'))
    or (select private.has_capability(organization_id, 'sales_access'))
  )
  with check (
    (select private.has_capability(organization_id, 'project_manager'))
    or (select private.has_capability(organization_id, 'sales_access'))
  );

-- Proposals, their sections and items: sales.
drop policy "proposals: org members add" on public.proposals;
drop policy "proposals: org members update" on public.proposals;
create policy "proposals: sales add" on public.proposals
  for insert to authenticated
  with check (created_by = (select auth.uid()) and (select private.has_capability(organization_id, 'sales_access')));
create policy "proposals: sales update" on public.proposals
  for update to authenticated
  using ((select private.has_capability(organization_id, 'sales_access')))
  with check ((select private.has_capability(organization_id, 'sales_access')));

drop policy "proposal sections: org members add" on public.proposal_sections;
drop policy "proposal sections: org members update" on public.proposal_sections;
drop policy "proposal sections: org members delete" on public.proposal_sections;
create policy "proposal sections: sales add" on public.proposal_sections
  for insert to authenticated
  with check (created_by = (select auth.uid()) and (select private.has_capability(organization_id, 'sales_access')));
create policy "proposal sections: sales update" on public.proposal_sections
  for update to authenticated
  using ((select private.has_capability(organization_id, 'sales_access')))
  with check ((select private.has_capability(organization_id, 'sales_access')));
create policy "proposal sections: sales delete" on public.proposal_sections
  for delete to authenticated using ((select private.has_capability(organization_id, 'sales_access')));

drop policy "proposal items: org members add" on public.proposal_items;
drop policy "proposal items: org members update" on public.proposal_items;
drop policy "proposal items: org members delete" on public.proposal_items;
create policy "proposal items: sales add" on public.proposal_items
  for insert to authenticated
  with check (created_by = (select auth.uid()) and (select private.has_capability(organization_id, 'sales_access')));
create policy "proposal items: sales update" on public.proposal_items
  for update to authenticated
  using ((select private.has_capability(organization_id, 'sales_access')))
  with check ((select private.has_capability(organization_id, 'sales_access')));
create policy "proposal items: sales delete" on public.proposal_items
  for delete to authenticated using ((select private.has_capability(organization_id, 'sales_access')));

-- Supplier directory: operations and finance.
drop policy "suppliers: org members add" on public.suppliers;
drop policy "suppliers: org members update" on public.suppliers;
create policy "suppliers: operations and finance add" on public.suppliers
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (select private.has_capability(organization_id, 'operations_access'))
      or (select private.has_capability(organization_id, 'finance_access'))
    )
  );
create policy "suppliers: operations and finance update" on public.suppliers
  for update to authenticated
  using (
    (select private.has_capability(organization_id, 'operations_access'))
    or (select private.has_capability(organization_id, 'finance_access'))
  )
  with check (
    (select private.has_capability(organization_id, 'operations_access'))
    or (select private.has_capability(organization_id, 'finance_access'))
  );

-- Inventory register: operations.
drop policy "inventory: org members add" on public.inventory_items;
drop policy "inventory: org members update" on public.inventory_items;
create policy "inventory: operations add" on public.inventory_items
  for insert to authenticated
  with check (created_by = (select auth.uid()) and (select private.has_capability(organization_id, 'operations_access')));
create policy "inventory: operations update" on public.inventory_items
  for update to authenticated
  using ((select private.has_capability(organization_id, 'operations_access')))
  with check ((select private.has_capability(organization_id, 'operations_access')));

-- ---------------------------------------------------------------------------
-- 6. An organisation always keeps at least one admin
-- ---------------------------------------------------------------------------

create or replace function private.keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin' or new.organization_id <> old.organization_id)
     -- Deleting the whole organisation (cascade) is allowed.
     and exists (select 1 from public.organizations o where o.id = old.organization_id)
     and not exists (
       select 1 from public.organization_members om
       where om.organization_id = old.organization_id and om.role = 'admin' and om.user_id <> old.user_id
     ) then
    raise exception 'An organisation needs at least one admin' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;
revoke execute on function private.keep_one_admin() from public, anon, authenticated;
create trigger organization_members_keep_one_admin
  before update of role, organization_id or delete on public.organization_members
  for each row execute function private.keep_one_admin();
