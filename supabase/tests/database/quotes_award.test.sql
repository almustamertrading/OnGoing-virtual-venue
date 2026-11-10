-- Workflow D: quote comparison fields and the human, reasoned, atomic award.
-- Acts as real users through request.jwt.claims; synthetic .test data; rolls back.

begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into public.organizations (id, name, email_domain) values ('a5000000-0000-4000-8000-00000000000a', 'Q Org', 'q-a.test');
insert into public.organization_domains (domain, organization_id) values ('q-a.test', 'a5000000-0000-4000-8000-00000000000a');
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email, now(),
       '{"provider":"email","providers":["email"]}', '{}', now() + (u.n || ' seconds')::interval, now()
from (values
  (1, 'a5000000-0000-4000-8000-0000000000a1', 'admin@q-a.test'),
  (2, 'a5000000-0000-4000-8000-0000000000a2', 'fin-editor@q-a.test'),
  (3, 'a5000000-0000-4000-8000-0000000000a3', 'fin-viewer@q-a.test'),
  (4, 'a5000000-0000-4000-8000-0000000000a4', 'sales@q-a.test')
) as u(n, id, email) order by u.n;
update public.organization_members set capabilities = '{finance_access}'
  where user_id in ('a5000000-0000-4000-8000-0000000000a2', 'a5000000-0000-4000-8000-0000000000a3');
update public.organization_members set capabilities = '{sales_access}' where user_id = 'a5000000-0000-4000-8000-0000000000a4';
insert into public.projects (id, organization_id, name, created_by) values
  ('a5000000-0000-4000-8000-0000000000e1', 'a5000000-0000-4000-8000-00000000000a', 'Q project', 'a5000000-0000-4000-8000-0000000000a1');
insert into public.project_members (project_id, user_id, role) values
  ('a5000000-0000-4000-8000-0000000000e1', 'a5000000-0000-4000-8000-0000000000a2', 'editor'),
  ('a5000000-0000-4000-8000-0000000000e1', 'a5000000-0000-4000-8000-0000000000a3', 'viewer'),
  ('a5000000-0000-4000-8000-0000000000e1', 'a5000000-0000-4000-8000-0000000000a4', 'editor');
insert into public.rfqs (id, project_id, title, status, created_by) values
  ('a5000000-0000-4000-8000-0000000000f1', 'a5000000-0000-4000-8000-0000000000e1', 'Staging', 'sent', 'a5000000-0000-4000-8000-0000000000a1');
insert into public.quotes (id, rfq_id, project_id, supplier_name, amount, status, created_by) values
  ('a5000000-0000-4000-8000-0000000000c1', 'a5000000-0000-4000-8000-0000000000f1', 'a5000000-0000-4000-8000-0000000000e1', 'Supplier A', 50000, 'received', 'a5000000-0000-4000-8000-0000000000a1'),
  ('a5000000-0000-4000-8000-0000000000c2', 'a5000000-0000-4000-8000-0000000000f1', 'a5000000-0000-4000-8000-0000000000e1', 'Supplier B', 42000, 'received', 'a5000000-0000-4000-8000-0000000000a1'),
  ('a5000000-0000-4000-8000-0000000000c3', 'a5000000-0000-4000-8000-0000000000f1', 'a5000000-0000-4000-8000-0000000000e1', 'Supplier C', null, 'received', 'a5000000-0000-4000-8000-0000000000a1');

set constraints all immediate;
set local role authenticated;

set local "request.jwt.claims" to '{"sub":"a5000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select lives_ok($$ update public.quotes set scope_basis = 'supply_install', exclusions = 'Power supply', valid_until = '2027-01-31',
  lead_time_days = 21, payment_terms = '30% advance' where id = 'a5000000-0000-4000-8000-0000000000c1' $$,
  'a finance editor records the comparison fields');
select throws_ok($$ update public.quotes set scope_basis = 'flying' where id = 'a5000000-0000-4000-8000-0000000000c1' $$,
  '23514', null, 'only known scope bases are accepted');
select throws_ok($$ insert into public.quotes (rfq_id, project_id, supplier_name, amount, status)
  values ('a5000000-0000-4000-8000-0000000000f1', 'a5000000-0000-4000-8000-0000000000e1', 'Sneaky', 1, 'accepted') $$,
  '42501', null, 'a quote cannot be created already awarded');
select throws_ok($$ select public.award_quote('a5000000-0000-4000-8000-0000000000c2', '  ') $$,
  '23514', null, 'an award needs a reason');
select throws_ok($$ select public.award_quote('a5000000-0000-4000-8000-0000000000c3', 'Cheapest') $$,
  '22023', null, 'a quote without a price cannot be awarded');
select lives_ok($$ select public.award_quote('a5000000-0000-4000-8000-0000000000c2', 'Lowest complete quote') $$,
  'the finance editor awards a quote with a reason');
select ok((select status = 'accepted' and awarded_by = 'a5000000-0000-4000-8000-0000000000a2' and awarded_at is not null
             and award_reason = 'Lowest complete quote' from public.quotes where id = 'a5000000-0000-4000-8000-0000000000c2'),
  'the award records who, when and why');
select is((select count(*) from public.quotes where rfq_id = 'a5000000-0000-4000-8000-0000000000f1' and status = 'rejected'), 2::bigint,
  'the other quotes are set aside');
select is((select status::text from public.rfqs where id = 'a5000000-0000-4000-8000-0000000000f1'), 'awarded', 'the RFQ is marked awarded');
select throws_ok($$ update public.quotes set awarded_by = 'a5000000-0000-4000-8000-0000000000a1' where id = 'a5000000-0000-4000-8000-0000000000c2' $$,
  '42501', null, 'award details cannot be rewritten');
select throws_ok($$ update public.quotes set status = 'accepted', award_reason = 'Second winner' where id = 'a5000000-0000-4000-8000-0000000000c1' $$,
  '23505', null, 'an RFQ has at most one awarded quote');
select lives_ok($$ select public.award_quote('a5000000-0000-4000-8000-0000000000c1', 'Better scope after clarification') $$,
  'the award can be moved to another quote, again with a reason');
select ok((select status = 'rejected' and awarded_by is null and award_reason = '' from public.quotes where id = 'a5000000-0000-4000-8000-0000000000c2'),
  'the earlier award is cleared');

set local "request.jwt.claims" to '{"sub":"a5000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
select throws_ok($$ select public.award_quote('a5000000-0000-4000-8000-0000000000c2', 'I prefer it') $$,
  '42501', null, 'a finance viewer cannot award');

set local "request.jwt.claims" to '{"sub":"a5000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
select is((select count(*) from public.quotes), 0::bigint, 'an editor without finance access sees no quotes');
select throws_ok($$ select public.award_quote('a5000000-0000-4000-8000-0000000000c2', 'Cheapest') $$,
  '42501', null, 'and cannot award one');

reset role;
select * from finish();
rollback;
