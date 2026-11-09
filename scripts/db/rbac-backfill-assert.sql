-- Assertions after the RBAC migration ran on rbac-backfill-fixture.sql.
-- Raises an exception (non-zero psql exit with ON_ERROR_STOP) on the first failure.
do $$
declare
  n bigint;
  s numeric;
begin
  -- Proposal costs moved: two non-zero costs, same total, old column blank.
  select count(*), sum(unit_cost) into n, s from public.proposal_item_costs;
  if n <> 2 or s <> 350.50 then
    raise exception 'proposal_item_costs: expected 2 rows / 350.50, got % / %', n, s;
  end if;
  if exists (select 1 from public.proposal_items where unit_cost <> 0) then
    raise exception 'proposal_items.unit_cost still holds values';
  end if;
  if exists (
    select 1 from public.proposal_item_costs c
    join (values ('a0000000-0000-4000-8000-0000000000c1'::uuid, 100.00),
                 ('a0000000-0000-4000-8000-0000000000c3'::uuid, 250.50)) v(id, cost)
      on v.id = c.item_id
    where c.unit_cost <> v.cost
  ) then
    raise exception 'proposal_item_costs: per-item values differ';
  end if;

  -- Inventory rates moved: 40 and 0 (null stays absent), old column blank.
  select count(*), sum(unit_rate) into n, s from public.inventory_item_costs;
  if n <> 2 or s <> 40.00 then
    raise exception 'inventory_item_costs: expected 2 rows / 40.00, got % / %', n, s;
  end if;
  if exists (select 1 from public.inventory_items where unit_rate is not null) then
    raise exception 'inventory_items.unit_rate still holds values';
  end if;

  -- Blanking kept each row's updated_at.
  if exists (select 1 from public.proposal_items where updated_at <> '2026-01-01 10:00:00+00')
     or exists (select 1 from public.inventory_items where updated_at <> '2026-01-01 10:00:00+00') then
    raise exception 'updated_at changed while blanking old columns';
  end if;

  -- Capabilities: admin stores none (derived), manager gets the manager set, no finance.
  if (select capabilities from public.organization_members
      where user_id = 'a0000000-0000-4000-8000-0000000000a1') <> '{}' then
    raise exception 'admin should store no capabilities';
  end if;
  if (select capabilities from public.organization_members
      where user_id = 'a0000000-0000-4000-8000-0000000000a2')
     <> '{project_manager,sales_access,operations_access}'::public.capability[] then
    raise exception 'manager capabilities not backfilled as expected';
  end if;

  raise notice 'RBAC data move: all checks passed';
end $$;
