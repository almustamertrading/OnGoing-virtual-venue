-- Database hygiene (Phase 2, Stage 1).
--
-- 1. Cover the foreign keys the performance advisor reports as unindexed.
-- 2. Replace the FOR ALL write policies on proposal sections/items with per-command
--    policies, so each SELECT is decided by a single policy.
-- 3. Tenant integrity: child rows that carry project_id / organization_id reference
--    their parent by (id, tenant), so the database rejects links across projects or
--    organisations (previously a member of one organisation could attach rows to
--    another organisation's proposal if they knew its id).
-- 4. A project cannot move to another organisation.
--
-- The migration runs in one transaction; any failure rolls all of it back.
-- No data is changed. Existing rows are validated when each constraint is added.

-- ---------------------------------------------------------------------------
-- 1. Covering indexes for flagged foreign keys
-- ---------------------------------------------------------------------------

create index proposal_items_created_by_idx on public.proposal_items (created_by);
create index proposal_sections_created_by_idx on public.proposal_sections (created_by);
create index proposals_owner_id_idx on public.proposals (owner_id);
create index team_roles_assignee_id_idx on public.team_roles (assignee_id);

-- proposals_client_fk is (client_id, organization_id); a client_id-only index does not cover it.
create index proposals_client_org_idx on public.proposals (client_id, organization_id);
drop index public.proposals_client_idx;

-- ---------------------------------------------------------------------------
-- 2. Per-command write policies (no FOR ALL overlap with the read policy)
-- ---------------------------------------------------------------------------

drop policy "proposal sections: org members write" on public.proposal_sections;
create policy "proposal sections: org members add" on public.proposal_sections
  for insert to authenticated
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));
create policy "proposal sections: org members update" on public.proposal_sections
  for update to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)));
create policy "proposal sections: org members delete" on public.proposal_sections
  for delete to authenticated using ((select private.is_org_member(organization_id)));

drop policy "proposal items: org members write" on public.proposal_items;
create policy "proposal items: org members add" on public.proposal_items
  for insert to authenticated
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));
create policy "proposal items: org members update" on public.proposal_items
  for update to authenticated
  using ((select private.is_org_member(organization_id)))
  with check ((select private.is_org_member(organization_id)));
create policy "proposal items: org members delete" on public.proposal_items
  for delete to authenticated using ((select private.is_org_member(organization_id)));

-- ---------------------------------------------------------------------------
-- 3. Tenant-safe references
-- ---------------------------------------------------------------------------

-- Parents expose (id, tenant) keys. rfqs, layouts and venues already have
-- (id, project_id); suppliers already has (id, organization_id).
alter table public.projects add constraint projects_id_org_key unique (id, organization_id);
alter table public.proposals add constraint proposals_id_org_key unique (id, organization_id);
alter table public.comments add constraint comments_id_project_key unique (id, project_id);

-- A reply stays in its parent comment's project.
alter table public.comments drop constraint comments_parent_id_fkey;
alter table public.comments add constraint comments_parent_fk
  foreign key (parent_id, project_id) references public.comments (id, project_id) on delete cascade;
drop index public.comments_parent_id_idx;
create index comments_parent_idx on public.comments (parent_id, project_id);

-- A layout's optional venue belongs to the same project.
alter table public.layouts drop constraint layouts_venue_id_fkey;
alter table public.layouts add constraint layouts_venue_fk
  foreign key (venue_id, project_id) references public.venues (id, project_id)
  on delete set null (venue_id);
drop index public.layouts_venue_id_idx;
create index layouts_venue_idx on public.layouts (venue_id, project_id);

-- Layout items belong to their layout's project.
alter table public.layout_items drop constraint layout_items_layout_id_fkey;
alter table public.layout_items add constraint layout_items_layout_fk
  foreign key (layout_id, project_id) references public.layouts (id, project_id) on delete cascade;
drop index public.layout_items_layout_id_idx;
create index layout_items_layout_idx on public.layout_items (layout_id, project_id);

-- Quotes belong to their RFQ's project.
alter table public.quotes drop constraint quotes_rfq_id_fkey;
alter table public.quotes add constraint quotes_rfq_fk
  foreign key (rfq_id, project_id) references public.rfqs (id, project_id) on delete cascade;
drop index public.quotes_rfq_id_idx;
create index quotes_rfq_idx on public.quotes (rfq_id, project_id);

-- A proposal's linked project belongs to the same organisation.
alter table public.proposals drop constraint proposals_project_id_fkey;
alter table public.proposals add constraint proposals_project_fk
  foreign key (project_id, organization_id) references public.projects (id, organization_id)
  on delete set null (project_id);
drop index public.proposals_project_idx;
create index proposals_project_org_idx on public.proposals (project_id, organization_id);

-- Proposal sections and items belong to their proposal's organisation.
alter table public.proposal_sections drop constraint proposal_sections_proposal_id_fkey;
alter table public.proposal_sections add constraint proposal_sections_proposal_fk
  foreign key (proposal_id, organization_id) references public.proposals (id, organization_id)
  on delete cascade;
drop index public.proposal_sections_proposal_id_idx;
create index proposal_sections_proposal_idx on public.proposal_sections (proposal_id, organization_id);

alter table public.proposal_items drop constraint proposal_items_proposal_id_fkey;
alter table public.proposal_items add constraint proposal_items_proposal_fk
  foreign key (proposal_id, organization_id) references public.proposals (id, organization_id)
  on delete cascade;
drop index public.proposal_items_proposal_id_idx;
create index proposal_items_proposal_idx on public.proposal_items (proposal_id, organization_id);

-- A proposal item's supplier belongs to the same organisation.
alter table public.proposal_items drop constraint proposal_items_supplier_id_fkey;
alter table public.proposal_items add constraint proposal_items_supplier_fk
  foreign key (supplier_id, organization_id) references public.suppliers (id, organization_id)
  on delete set null (supplier_id);
create index proposal_items_supplier_idx on public.proposal_items (supplier_id, organization_id);

-- Quotes carry no organisation column, so a trigger checks that the supplier
-- belongs to the project's organisation.
create or replace function private.quotes_check_supplier()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.supplier_id is not null and not exists (
    select 1
    from public.suppliers s
    join public.projects p on p.organization_id = s.organization_id
    where s.id = new.supplier_id and p.id = new.project_id
  ) then
    raise exception 'Supplier belongs to another organisation' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke execute on function private.quotes_check_supplier() from public, anon, authenticated;
create trigger quotes_check_supplier before insert or update of supplier_id, project_id on public.quotes
  for each row execute function private.quotes_check_supplier();

-- ---------------------------------------------------------------------------
-- 4. A project's organisation is fixed once created
-- ---------------------------------------------------------------------------

create or replace function private.projects_keep_organization()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'A project cannot move to another organisation' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.projects_keep_organization() from public, anon, authenticated;
create trigger projects_keep_organization before update of organization_id on public.projects
  for each row execute function private.projects_keep_organization();
