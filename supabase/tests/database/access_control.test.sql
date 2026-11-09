-- Direct unauthorized-access tests at the database level (RLS, capabilities,
-- tenant integrity). Runs with `npx supabase test db` against the LOCAL stack.
-- Every test acts as a real authenticated user via request.jwt.claims.
-- Synthetic data on reserved .test domains; everything rolls back.

begin;
create extension if not exists pgtap with schema extensions;
select plan(53);

-- ---------------------------------------------------------------------------
-- Fixture (as postgres)
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, email_domain) values
  ('a0000000-0000-4000-8000-00000000000a', 'QA Org A', 'qa-a.test'),
  ('b0000000-0000-4000-8000-00000000000b', 'QA Org B', 'qa-b.test');
insert into public.organization_domains (domain, organization_id) values
  ('qa-a.test', 'a0000000-0000-4000-8000-00000000000a'),
  ('qa-b.test', 'b0000000-0000-4000-8000-00000000000b');

-- First user per domain becomes that organisation's admin; later ones join as staff.
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email, now(),
       '{"provider":"email","providers":["email"]}', '{}', now() + (u.n || ' seconds')::interval, now()
from (values
  (1, 'a0000000-0000-4000-8000-0000000000a1', 'admin@qa-a.test'),
  (2, 'a0000000-0000-4000-8000-0000000000a2', 'finance@qa-a.test'),
  (3, 'a0000000-0000-4000-8000-0000000000a3', 'sales@qa-a.test'),
  (4, 'a0000000-0000-4000-8000-0000000000a4', 'ops@qa-a.test'),
  (5, 'a0000000-0000-4000-8000-0000000000a5', 'pm@qa-a.test'),
  (6, 'a0000000-0000-4000-8000-0000000000a6', 'viewer@qa-a.test'),
  (7, 'b0000000-0000-4000-8000-0000000000b1', 'admin@qa-b.test'),
  (8, 'c0000000-0000-4000-8000-0000000000c1', 'partner@partner.test')
) as u(n, id, email)
order by u.n;

update public.organization_members set capabilities = '{finance_access}'
  where user_id = 'a0000000-0000-4000-8000-0000000000a2';
update public.organization_members set capabilities = '{sales_access}'
  where user_id = 'a0000000-0000-4000-8000-0000000000a3';
update public.organization_members set capabilities = '{operations_access}'
  where user_id = 'a0000000-0000-4000-8000-0000000000a4';
update public.organization_members set capabilities = '{project_manager}'
  where user_id = 'a0000000-0000-4000-8000-0000000000a5';

insert into public.projects (id, organization_id, name, created_by) values
  ('a0000000-0000-4000-8000-0000000000e1', 'a0000000-0000-4000-8000-00000000000a', 'QA project A1', 'a0000000-0000-4000-8000-0000000000a1'),
  ('a0000000-0000-4000-8000-0000000000e2', 'a0000000-0000-4000-8000-00000000000a', 'QA project A2', 'a0000000-0000-4000-8000-0000000000a1'),
  ('b0000000-0000-4000-8000-0000000000e1', 'b0000000-0000-4000-8000-00000000000b', 'QA project B1', 'b0000000-0000-4000-8000-0000000000b1');

insert into public.project_members (project_id, user_id, role) values
  ('a0000000-0000-4000-8000-0000000000e1', 'a0000000-0000-4000-8000-0000000000a2', 'viewer'),
  ('a0000000-0000-4000-8000-0000000000e1', 'a0000000-0000-4000-8000-0000000000a3', 'editor'),
  ('a0000000-0000-4000-8000-0000000000e1', 'a0000000-0000-4000-8000-0000000000a4', 'editor'),
  ('a0000000-0000-4000-8000-0000000000e1', 'a0000000-0000-4000-8000-0000000000a6', 'viewer'),
  ('a0000000-0000-4000-8000-0000000000e1', 'c0000000-0000-4000-8000-0000000000c1', 'viewer');

insert into public.invoices (project_id, number, title, amount, created_by) values
  ('a0000000-0000-4000-8000-0000000000e1', 'INV-QA-1', 'QA invoice', 1000, 'a0000000-0000-4000-8000-0000000000a1');
insert into public.expenses (project_id, label, amount, created_by) values
  ('a0000000-0000-4000-8000-0000000000e1', 'QA expense', 400, 'a0000000-0000-4000-8000-0000000000a1');
insert into public.rfqs (id, project_id, title, created_by) values
  ('a0000000-0000-4000-8000-0000000000f1', 'a0000000-0000-4000-8000-0000000000e1', 'QA RFQ', 'a0000000-0000-4000-8000-0000000000a1');
insert into public.quotes (rfq_id, project_id, supplier_name, amount, created_by) values
  ('a0000000-0000-4000-8000-0000000000f1', 'a0000000-0000-4000-8000-0000000000e1', 'QA supplier', 500, 'a0000000-0000-4000-8000-0000000000a1');

insert into public.suppliers (id, organization_id, name, created_by) values
  ('a0000000-0000-4000-8000-000000000051', 'a0000000-0000-4000-8000-00000000000a', 'Supplier A', 'a0000000-0000-4000-8000-0000000000a1'),
  ('b0000000-0000-4000-8000-000000000051', 'b0000000-0000-4000-8000-00000000000b', 'Supplier B', 'b0000000-0000-4000-8000-0000000000b1');

insert into public.proposals (id, organization_id, title, created_by) values
  ('a0000000-0000-4000-8000-0000000000b1', 'a0000000-0000-4000-8000-00000000000a', 'QA proposal', 'a0000000-0000-4000-8000-0000000000a1');
insert into public.proposal_items (id, proposal_id, organization_id, description, unit_price, created_by) values
  ('a0000000-0000-4000-8000-0000000000c1', 'a0000000-0000-4000-8000-0000000000b1', 'a0000000-0000-4000-8000-00000000000a',
   'Stage', 180, 'a0000000-0000-4000-8000-0000000000a1');
insert into public.proposal_item_costs (item_id, organization_id, unit_cost) values
  ('a0000000-0000-4000-8000-0000000000c1', 'a0000000-0000-4000-8000-00000000000a', 100);

insert into public.inventory_items (id, organization_id, name, quantity, created_by) values
  ('a0000000-0000-4000-8000-0000000000d1', 'a0000000-0000-4000-8000-00000000000a', 'Chairs', 100, 'a0000000-0000-4000-8000-0000000000a1');
insert into public.inventory_item_costs (item_id, organization_id, unit_rate) values
  ('a0000000-0000-4000-8000-0000000000d1', 'a0000000-0000-4000-8000-00000000000a', 40);

insert into public.venues (id, project_id, name, center_lng, center_lat, created_by) values
  ('a0000000-0000-4000-8000-0000000000ac', 'a0000000-0000-4000-8000-0000000000e1', 'Venue A', 46.7, 24.7, 'a0000000-0000-4000-8000-0000000000a1'),
  ('b0000000-0000-4000-8000-0000000000ac', 'b0000000-0000-4000-8000-0000000000e1', 'Venue B', 46.7, 24.7, 'b0000000-0000-4000-8000-0000000000b1');
insert into public.comments (id, project_id, venue_id, body, lng, lat, created_by) values
  ('a0000000-0000-4000-8000-0000000000ab', 'a0000000-0000-4000-8000-0000000000e1', 'a0000000-0000-4000-8000-0000000000ac',
   'A comment', 46.7, 24.7, 'a0000000-0000-4000-8000-0000000000a1');

-- Check foreign keys per statement, so cross-tenant violations surface inside each test.
set constraints all immediate;

-- ---------------------------------------------------------------------------
-- 1. Financial confidentiality: reads
-- ---------------------------------------------------------------------------
set local role authenticated;

set local "request.jwt.claims" to '{"sub":"a0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select count(*) from public.invoices), 1::bigint, 'admin reads project invoices');
select is((select count(*) from public.proposal_item_costs), 1::bigint, 'admin reads proposal costs');

set local "request.jwt.claims" to '{"sub":"a0000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select is((select count(*) from public.invoices), 1::bigint, 'finance member reads invoices');
select is((select count(*) from public.expenses), 1::bigint, 'finance member reads expenses');
select is((select count(*) from public.quotes), 1::bigint, 'finance member reads supplier quotes');
select is((select count(*) from public.proposal_item_costs), 1::bigint, 'finance reads proposal costs');
select is((select count(*) from public.inventory_item_costs), 1::bigint, 'finance reads inventory valuation');
select ok((select count(*) from public.activity where entity_type = 'invoices') > 0, 'finance sees invoice activity');

set local "request.jwt.claims" to '{"sub":"a0000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
select is((select count(*) from public.invoices), 0::bigint, 'sales editor cannot read invoices');
select is((select count(*) from public.expenses), 0::bigint, 'sales editor cannot read expenses');
select is((select count(*) from public.proposal_item_costs), 0::bigint, 'sales cannot read proposal costs');
select is((select unit_cost from public.proposal_items), 0::numeric, 'old proposal cost column holds no value');
select is((select count(*) from public.activity where entity_type in ('invoices', 'expenses', 'quotes')),
  0::bigint, 'sales cannot see finance activity lines');
select ok((select count(*) from public.activity) > 0, 'sales still sees other project activity');

set local "request.jwt.claims" to '{"sub":"a0000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
select is((select count(*) from public.quotes), 0::bigint, 'operations editor cannot read supplier quotes');
select is((select count(*) from public.rfqs), 1::bigint, 'operations editor still reads RFQs');
select is((select count(*) from public.inventory_item_costs), 0::bigint, 'operations cannot read inventory valuation');
select is((select count(*) from public.inventory_items), 1::bigint, 'operations reads inventory items');

set local "request.jwt.claims" to '{"sub":"a0000000-0000-4000-8000-0000000000a6","role":"authenticated"}';
select is((select count(*) from public.invoices), 0::bigint, 'viewer cannot read invoices');
select is((select count(*) from public.projects), 1::bigint, 'viewer reads the project it belongs to');

set local "request.jwt.claims" to '{"sub":"c0000000-0000-4000-8000-0000000000c1","role":"authenticated"}';
select is((select count(*) from public.invoices), 0::bigint, 'external partner cannot read invoices');
select is((select count(*) from public.proposals), 0::bigint, 'external partner cannot read org proposals');

set local "request.jwt.claims" to '{"sub":"b0000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is((select count(*) from public.invoices), 0::bigint, 'other organisation admin cannot read invoices');
select is((select count(*) from public.proposal_item_costs), 0::bigint, 'other organisation admin cannot read costs');

-- ---------------------------------------------------------------------------
-- 2. Financial confidentiality: writes
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"a0000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
select throws_ok($$ insert into public.invoices (project_id, title, amount)
  values ('a0000000-0000-4000-8000-0000000000e1', 'x', 1) $$, '42501', null, 'sales cannot create invoices');
select throws_ok($$ insert into public.proposal_item_costs (item_id, organization_id, unit_cost)
  values ('a0000000-0000-4000-8000-0000000000c1', 'a0000000-0000-4000-8000-00000000000a', 1)
  on conflict (item_id, organization_id) do update set unit_cost = 1 $$, '42501', null, 'sales cannot write costs');
select lives_ok($$ update public.proposal_items set unit_cost = 999 $$, 'sales may still edit an item');

set local "request.jwt.claims" to '{"sub":"a0000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select is((select unit_cost from public.proposal_item_costs), 100::numeric,
  'a non-finance write to the old cost column is discarded');
select lives_ok($$ insert into public.invoices (project_id, title, amount, created_by)
  values ('a0000000-0000-4000-8000-0000000000e1', 'Finance invoice', 10, 'a0000000-0000-4000-8000-0000000000a2') $$,
  'finance member creates an invoice');
select lives_ok($$ update public.proposal_item_costs set unit_cost = 110 $$, 'finance updates a cost');
select is((select unit_cost from public.proposal_item_costs), 110::numeric, 'cost updated by finance');

set local "request.jwt.claims" to '{"sub":"a0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select lives_ok($$ update public.proposal_items set unit_cost = 120 $$, 'admin writes through the old column');
select is((select unit_cost from public.proposal_item_costs), 120::numeric, 'old-column write moved to the cost table');

set local "request.jwt.claims" to '{"sub":"b0000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select throws_ok($$ insert into public.proposal_item_costs (item_id, organization_id, unit_cost)
  values ('a0000000-0000-4000-8000-0000000000c1', 'b0000000-0000-4000-8000-00000000000b', 1) $$,
  '23503', null, 'other organisation cannot attach a cost to this item');

-- ---------------------------------------------------------------------------
-- 3. Capability-gated creation
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"a0000000-0000-4000-8000-0000000000a6","role":"authenticated"}';
select throws_ok($$ insert into public.projects (organization_id, name, created_by)
  values ('a0000000-0000-4000-8000-00000000000a', 'x', 'a0000000-0000-4000-8000-0000000000a6') $$,
  '42501', null, 'viewer cannot create projects');
select throws_ok($$ insert into public.proposals (organization_id, title, created_by)
  values ('a0000000-0000-4000-8000-00000000000a', 'x', 'a0000000-0000-4000-8000-0000000000a6') $$,
  '42501', null, 'viewer cannot create proposals');
select throws_ok($$ insert into public.suppliers (organization_id, name)
  values ('a0000000-0000-4000-8000-00000000000a', 'x') $$, '42501', null, 'viewer cannot add suppliers');

set local "request.jwt.claims" to '{"sub":"a0000000-0000-4000-8000-0000000000a5","role":"authenticated"}';
select lives_ok($$ insert into public.projects (organization_id, name, created_by)
  values ('a0000000-0000-4000-8000-00000000000a', 'PM project', 'a0000000-0000-4000-8000-0000000000a5') $$,
  'project manager creates a project');

set local "request.jwt.claims" to '{"sub":"a0000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
select lives_ok($$ insert into public.proposals (organization_id, title, created_by)
  values ('a0000000-0000-4000-8000-00000000000a', 'Sales proposal', 'a0000000-0000-4000-8000-0000000000a3') $$,
  'sales creates a proposal');
select throws_ok($$ insert into public.inventory_items (organization_id, name)
  values ('a0000000-0000-4000-8000-00000000000a', 'x') $$, '42501', null, 'sales cannot add inventory');

set local "request.jwt.claims" to '{"sub":"a0000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
select lives_ok($$ insert into public.suppliers (organization_id, name)
  values ('a0000000-0000-4000-8000-00000000000a', 'Ops supplier') $$, 'operations adds a supplier');
select results_eq($$ with u as (update public.proposals set title = 'changed' returning 1) select count(*)::int from u $$,
  $$ values (0) $$, 'operations cannot edit proposals');

-- ---------------------------------------------------------------------------
-- 4. Capability administration
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"a0000000-0000-4000-8000-0000000000a6","role":"authenticated"}';
select results_eq($$ with u as (update public.organization_members set capabilities = '{finance_access}'
  where user_id = 'a0000000-0000-4000-8000-0000000000a6' returning 1) select count(*)::int from u $$,
  $$ values (0) $$, 'a member cannot grant themselves capabilities');

set local "request.jwt.claims" to '{"sub":"a0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select throws_ok($$ update public.organization_members set capabilities = '{organization_admin}'
  where user_id = 'a0000000-0000-4000-8000-0000000000a6' $$, '23514', null,
  'organization_admin is the admin role, never a stored capability');

set local "request.jwt.claims" to '{"sub":"a0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select throws_ok($$ update public.organization_members set role = 'staff'
  where user_id = 'a0000000-0000-4000-8000-0000000000a1' $$, '23514', null,
  'the last admin cannot step down');
select lives_ok($$ update public.organization_members set capabilities = '{finance_access}'
  where user_id = 'a0000000-0000-4000-8000-0000000000a6' $$, 'admin grants finance to a member');
-- ---------------------------------------------------------------------------
-- 5. Tenant integrity
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"b0000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select throws_ok($$ insert into public.proposal_items (proposal_id, organization_id, description)
  values ('a0000000-0000-4000-8000-0000000000b1', 'b0000000-0000-4000-8000-00000000000b', 'injected') $$,
  '23503', null, 'cannot attach an item to another organisation''s proposal');
select throws_ok($$ insert into public.comments (project_id, venue_id, parent_id, body)
  values ('b0000000-0000-4000-8000-0000000000e1', 'b0000000-0000-4000-8000-0000000000ac',
          'a0000000-0000-4000-8000-0000000000ab', 'cross-project reply') $$,
  '23503', null, 'a reply must point to a comment in the same project');

set local "request.jwt.claims" to '{"sub":"a0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select throws_ok($$ insert into public.quotes (rfq_id, project_id, supplier_name)
  values ('a0000000-0000-4000-8000-0000000000f1', 'a0000000-0000-4000-8000-0000000000e2', 'x') $$,
  '23503', null, 'a quote must belong to its RFQ''s project');
select throws_ok($$ insert into public.quotes (rfq_id, project_id, supplier_id, supplier_name)
  values ('a0000000-0000-4000-8000-0000000000f1', 'a0000000-0000-4000-8000-0000000000e1',
          'b0000000-0000-4000-8000-000000000051', 'x') $$,
  '23503', null, 'a quote cannot use another organisation''s supplier');
select throws_ok($$ update public.projects set organization_id = 'b0000000-0000-4000-8000-00000000000b'
  where id = 'a0000000-0000-4000-8000-0000000000e2' $$, '42501', null,
  'a project cannot move to another organisation');

-- ---------------------------------------------------------------------------
-- 6. Admin hand-over (last, because it changes the admin)
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"a0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select lives_ok($$ update public.organization_members set role = 'admin'
  where user_id = 'a0000000-0000-4000-8000-0000000000a5' $$, 'admin promotes a second admin');
select lives_ok($$ update public.organization_members set role = 'staff'
  where user_id = 'a0000000-0000-4000-8000-0000000000a1' $$, 'an admin can step down when another admin exists');

reset role;
select * from finish();
rollback;
