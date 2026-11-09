-- ROLLBACK for release S1-5: reverses migrations 20261109170000_rbac_capabilities and
-- 20261109160000_db_hygiene, restoring the exact previous schema and data.
-- Verified on the isolated production-shaped mirror: schema dump and data fingerprint after
-- rollback are identical to before the migration (docs/releases/2026-11-S1-5/READINESS.md).
--
-- Run as ONE transaction (psql -1, or the SQL editor runs a single batch). Any error rolls it back.
-- Costs entered after go-live (in the finance-only tables) are copied back into the old columns
-- before those tables are dropped, so no data is lost.
-- After running it, redeploy the previous app version (deploy branch commit 19e66fc).

-- ===========================================================================
-- Part A: reverse RBAC (20261109170000)
-- ===========================================================================

-- A6. Last-admin guard
drop trigger organization_members_keep_one_admin on public.organization_members;
drop function private.keep_one_admin();

-- A5. Creation policies back to "any organisation member"
drop policy "projects: managers and sales create" on public.projects;
create policy "projects: org members create" on public.projects
  for insert to authenticated
  with check ((created_by = (select auth.uid())) and (select private.is_org_member(organization_id)));

drop policy "clients: managers and sales add" on public.clients;
drop policy "clients: managers and sales update" on public.clients;
create policy "clients: org members add" on public.clients
  for insert to authenticated
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));
create policy "clients: org members update" on public.clients
  for update to authenticated
  using ((select private.is_org_member(organization_id))) with check ((select private.is_org_member(organization_id)));

drop policy "proposals: sales add" on public.proposals;
drop policy "proposals: sales update" on public.proposals;
create policy "proposals: org members add" on public.proposals
  for insert to authenticated
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));
create policy "proposals: org members update" on public.proposals
  for update to authenticated
  using ((select private.is_org_member(organization_id))) with check ((select private.is_org_member(organization_id)));

drop policy "proposal sections: sales add" on public.proposal_sections;
drop policy "proposal sections: sales update" on public.proposal_sections;
drop policy "proposal sections: sales delete" on public.proposal_sections;
drop policy "proposal items: sales add" on public.proposal_items;
drop policy "proposal items: sales update" on public.proposal_items;
drop policy "proposal items: sales delete" on public.proposal_items;
-- Back to the hygiene-migration state (Part B then restores the original FOR ALL policies).
create policy "proposal sections: org members add" on public.proposal_sections
  for insert to authenticated
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));
create policy "proposal sections: org members update" on public.proposal_sections
  for update to authenticated
  using ((select private.is_org_member(organization_id))) with check ((select private.is_org_member(organization_id)));
create policy "proposal sections: org members delete" on public.proposal_sections
  for delete to authenticated using ((select private.is_org_member(organization_id)));
create policy "proposal items: org members add" on public.proposal_items
  for insert to authenticated
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));
create policy "proposal items: org members update" on public.proposal_items
  for update to authenticated
  using ((select private.is_org_member(organization_id))) with check ((select private.is_org_member(organization_id)));
create policy "proposal items: org members delete" on public.proposal_items
  for delete to authenticated using ((select private.is_org_member(organization_id)));

drop policy "suppliers: operations and finance add" on public.suppliers;
drop policy "suppliers: operations and finance update" on public.suppliers;
create policy "suppliers: org members add" on public.suppliers
  for insert to authenticated
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));
create policy "suppliers: org members update" on public.suppliers
  for update to authenticated
  using ((select private.is_org_member(organization_id))) with check ((select private.is_org_member(organization_id)));

drop policy "inventory: operations add" on public.inventory_items;
drop policy "inventory: operations update" on public.inventory_items;
create policy "inventory: org members add" on public.inventory_items
  for insert to authenticated
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));
create policy "inventory: org members update" on public.inventory_items
  for update to authenticated
  using ((select private.is_org_member(organization_id))) with check ((select private.is_org_member(organization_id)));

-- A4. Internal costs back into the original columns (move triggers first, so they do not intercept).
drop trigger proposal_items_move_cost on public.proposal_items;
drop trigger inventory_items_move_rate on public.inventory_items;
drop function private.proposal_items_move_cost();
drop function private.inventory_items_move_rate();

alter table public.proposal_items disable trigger proposal_items_updated_at;
update public.proposal_items i set unit_cost = c.unit_cost
from public.proposal_item_costs c where c.item_id = i.id;
alter table public.proposal_items enable trigger proposal_items_updated_at;

alter table public.inventory_items disable trigger inventory_items_updated_at;
update public.inventory_items i set unit_rate = c.unit_rate
from public.inventory_item_costs c where c.item_id = i.id;
alter table public.inventory_items enable trigger inventory_items_updated_at;

do $$
begin
  if (select coalesce(sum(unit_cost), 0) from public.proposal_items) <> (select coalesce(sum(unit_cost), 0) from public.proposal_item_costs)
     or (select coalesce(sum(unit_rate), 0) from public.inventory_items) <> (select coalesce(sum(unit_rate), 0) from public.inventory_item_costs) then
    raise exception 'rollback: copied-back costs do not match the finance tables';
  end if;
end $$;

drop table public.proposal_item_costs;
drop table public.inventory_item_costs;
alter table public.proposal_items drop constraint proposal_items_id_org_key;

-- A3. Finance records back to project-member access
drop policy "activity: members read" on public.activity;
create policy "activity: members read" on public.activity
  for select to authenticated using ((select private.is_member(project_id)));

drop policy "quotes: finance read" on public.quotes;
drop policy "quotes: finance insert" on public.quotes;
drop policy "quotes: finance update" on public.quotes;
drop policy "quotes: finance delete" on public.quotes;
create policy "quotes: members read" on public.quotes
  for select to authenticated using ((select private.is_member(project_id)));
create policy "quotes: editors insert" on public.quotes
  for insert to authenticated with check ((select private.can_edit(project_id)));
create policy "quotes: editors update" on public.quotes
  for update to authenticated
  using ((select private.can_edit(project_id))) with check ((select private.can_edit(project_id)));
create policy "quotes: editors delete" on public.quotes
  for delete to authenticated using ((select private.can_edit(project_id)));

drop policy "expenses: finance read" on public.expenses;
drop policy "expenses: finance insert" on public.expenses;
drop policy "expenses: finance update" on public.expenses;
drop policy "expenses: finance delete" on public.expenses;
create policy "expenses: members read" on public.expenses
  for select to authenticated using ((select private.is_member(project_id)));
create policy "expenses: editors insert" on public.expenses
  for insert to authenticated with check ((select private.can_edit(project_id)));
create policy "expenses: editors update" on public.expenses
  for update to authenticated
  using ((select private.can_edit(project_id))) with check ((select private.can_edit(project_id)));
create policy "expenses: editors delete" on public.expenses
  for delete to authenticated using ((select private.can_edit(project_id)));

drop policy "invoices: finance read" on public.invoices;
drop policy "invoices: finance insert" on public.invoices;
drop policy "invoices: finance update" on public.invoices;
drop policy "invoices: finance delete" on public.invoices;
create policy "invoices: members read" on public.invoices
  for select to authenticated using ((select private.is_member(project_id)));
create policy "invoices: editors insert" on public.invoices
  for insert to authenticated with check ((select private.can_edit(project_id)));
create policy "invoices: editors update" on public.invoices
  for update to authenticated
  using ((select private.can_edit(project_id))) with check ((select private.can_edit(project_id)));
create policy "invoices: editors delete" on public.invoices
  for delete to authenticated using ((select private.can_edit(project_id)));

-- A2. Helpers
drop function private.can_access_project_finance(uuid);
drop function private.has_capability(uuid, public.capability);

-- A1. Capabilities
alter table public.organization_members drop constraint organization_members_admin_capability_is_role;
alter table public.organization_members drop column capabilities;
drop type public.capability;

-- ===========================================================================
-- Part B: reverse hygiene (20261109160000)
-- ===========================================================================

-- B4. Project organisation lock
drop trigger projects_keep_organization on public.projects;
drop function private.projects_keep_organization();

-- B3. Quote supplier check and tenant-safe references → original single-column keys
drop trigger quotes_check_supplier on public.quotes;
drop function private.quotes_check_supplier();

alter table public.proposal_items drop constraint proposal_items_supplier_fk;
drop index public.proposal_items_supplier_idx;
alter table public.proposal_items add constraint proposal_items_supplier_id_fkey
  foreign key (supplier_id) references public.suppliers (id) on delete set null;

alter table public.proposal_items drop constraint proposal_items_proposal_fk;
drop index public.proposal_items_proposal_idx;
alter table public.proposal_items add constraint proposal_items_proposal_id_fkey
  foreign key (proposal_id) references public.proposals (id) on delete cascade;
create index proposal_items_proposal_id_idx on public.proposal_items (proposal_id);

alter table public.proposal_sections drop constraint proposal_sections_proposal_fk;
drop index public.proposal_sections_proposal_idx;
alter table public.proposal_sections add constraint proposal_sections_proposal_id_fkey
  foreign key (proposal_id) references public.proposals (id) on delete cascade;
create index proposal_sections_proposal_id_idx on public.proposal_sections (proposal_id);

alter table public.proposals drop constraint proposals_project_fk;
drop index public.proposals_project_org_idx;
alter table public.proposals add constraint proposals_project_id_fkey
  foreign key (project_id) references public.projects (id) on delete set null;
create index proposals_project_idx on public.proposals (project_id);

alter table public.quotes drop constraint quotes_rfq_fk;
drop index public.quotes_rfq_idx;
alter table public.quotes add constraint quotes_rfq_id_fkey
  foreign key (rfq_id) references public.rfqs (id) on delete cascade;
create index quotes_rfq_id_idx on public.quotes (rfq_id);

alter table public.layout_items drop constraint layout_items_layout_fk;
drop index public.layout_items_layout_idx;
alter table public.layout_items add constraint layout_items_layout_id_fkey
  foreign key (layout_id) references public.layouts (id) on delete cascade;
create index layout_items_layout_id_idx on public.layout_items (layout_id);

alter table public.layouts drop constraint layouts_venue_fk;
drop index public.layouts_venue_idx;
alter table public.layouts add constraint layouts_venue_id_fkey
  foreign key (venue_id) references public.venues (id) on delete set null;
create index layouts_venue_id_idx on public.layouts (venue_id);

alter table public.comments drop constraint comments_parent_fk;
drop index public.comments_parent_idx;
alter table public.comments add constraint comments_parent_id_fkey
  foreign key (parent_id) references public.comments (id) on delete cascade;
create index comments_parent_id_idx on public.comments (parent_id);

alter table public.comments drop constraint comments_id_project_key;
alter table public.proposals drop constraint proposals_id_org_key;
alter table public.projects drop constraint projects_id_org_key;

-- B2. Proposal sections/items write policies back to FOR ALL
drop policy "proposal sections: org members add" on public.proposal_sections;
drop policy "proposal sections: org members update" on public.proposal_sections;
drop policy "proposal sections: org members delete" on public.proposal_sections;
create policy "proposal sections: org members write" on public.proposal_sections
  for all to authenticated
  using ((select private.is_org_member(organization_id))) with check ((select private.is_org_member(organization_id)));

drop policy "proposal items: org members add" on public.proposal_items;
drop policy "proposal items: org members update" on public.proposal_items;
drop policy "proposal items: org members delete" on public.proposal_items;
create policy "proposal items: org members write" on public.proposal_items
  for all to authenticated
  using ((select private.is_org_member(organization_id))) with check ((select private.is_org_member(organization_id)));

-- B1. Indexes
drop index public.proposals_client_org_idx;
create index proposals_client_idx on public.proposals (client_id);
drop index public.team_roles_assignee_id_idx;
drop index public.proposals_owner_id_idx;
drop index public.proposal_sections_created_by_idx;
drop index public.proposal_items_created_by_idx;

-- Migration history: forget the two versions so the history matches the schema again.
-- (Replace with the versions production actually recorded if they differ.)
delete from supabase_migrations.schema_migrations where version in ('20261109160000', '20261109170000');
