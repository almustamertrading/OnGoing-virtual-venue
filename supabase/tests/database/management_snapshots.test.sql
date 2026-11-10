-- Workflow F: weekly management snapshots are private to their owner, one per week, immutable, never finance.
-- Acts as real users through request.jwt.claims; synthetic .test data; rolls back.

begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into public.organizations (id, name, email_domain) values
  ('f9000000-0000-4000-8000-00000000000a', 'Snap Org', 'snap-a.test'),
  ('f9000000-0000-4000-8000-00000000000b', 'Snap Other', 'snap-b.test');
insert into public.organization_domains (domain, organization_id) values
  ('snap-a.test', 'f9000000-0000-4000-8000-00000000000a'), ('snap-b.test', 'f9000000-0000-4000-8000-00000000000b');
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email, now(),
       '{"provider":"email","providers":["email"]}', '{}', now() + (u.n || ' seconds')::interval, now()
from (values
  (1, 'f9000000-0000-4000-8000-0000000000a1', 'admin@snap-a.test'),
  (2, 'f9000000-0000-4000-8000-0000000000a2', 'pm@snap-a.test'),
  (3, 'f9000000-0000-4000-8000-0000000000b1', 'admin@snap-b.test')
) as u(n, id, email) order by u.n;

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"f9000000-0000-4000-8000-0000000000a2","role":"authenticated"}';

select lives_ok($$ insert into public.management_snapshots (organization_id, week_start, facts)
  values ('f9000000-0000-4000-8000-00000000000a', '2026-11-08', '{"tasks.overdue": 3, "risks.high": 1}') $$,
  'a member records their own weekly snapshot');
select throws_ok($$ insert into public.management_snapshots (organization_id, week_start, facts)
  values ('f9000000-0000-4000-8000-00000000000a', '2026-11-08', '{"tasks.overdue": 4}') $$,
  '23505', null, 'one snapshot per user per week');
select throws_ok($$ insert into public.management_snapshots (organization_id, week_start, facts)
  values ('f9000000-0000-4000-8000-00000000000a', '2026-11-10', '{"tasks.overdue": 4}') $$,
  '23514', null, 'a week starts on Sunday');
select throws_ok($$ insert into public.management_snapshots (organization_id, week_start, facts)
  values ('f9000000-0000-4000-8000-00000000000a', '2026-11-01', '{"tasks.overdue": 4, "finance.overdue_amount": 150000}') $$,
  '23514', null, 'finance figures are never stored in a snapshot');
select throws_ok($$ insert into public.management_snapshots (organization_id, user_id, week_start, facts)
  values ('f9000000-0000-4000-8000-00000000000a', 'f9000000-0000-4000-8000-0000000000a1', '2026-11-01', '{}') $$,
  '42501', null, 'nobody records a snapshot for someone else');
select throws_ok($$ update public.management_snapshots set facts = '{"tasks.overdue": 0}' $$,
  '42501', null, 'a snapshot cannot be changed');

set local "request.jwt.claims" to '{"sub":"f9000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select count(*)::int from public.management_snapshots), 0, 'even an organisation admin cannot read another member''s snapshots');

set local "request.jwt.claims" to '{"sub":"f9000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select throws_ok($$ insert into public.management_snapshots (organization_id, week_start, facts)
  values ('f9000000-0000-4000-8000-00000000000a', '2026-11-01', '{}') $$,
  '42501', null, 'a member of another organisation cannot record one there');

set local "request.jwt.claims" to '{"sub":"f9000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select is((select (facts ->> 'tasks.overdue')::int from public.management_snapshots where week_start = '2026-11-08'), 3,
  'the owner reads their snapshot back unchanged');

select * from finish();
rollback;
