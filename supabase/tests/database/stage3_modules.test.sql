-- Stage 3 database contracts: settings, admin audit, calendar, documents, reports.
-- Acts as real users through request.jwt.claims; synthetic .test data; rolls back.

begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

-- ---------------------------------------------------------------------------
-- Fixture
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, email_domain) values
  ('a1000000-0000-4000-8000-00000000000a', 'S3 Org A', 's3-a.test'),
  ('b1000000-0000-4000-8000-00000000000b', 'S3 Org B', 's3-b.test');
insert into public.organization_domains (domain, organization_id) values
  ('s3-a.test', 'a1000000-0000-4000-8000-00000000000a'),
  ('s3-b.test', 'b1000000-0000-4000-8000-00000000000b');

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email, now(),
       '{"provider":"email","providers":["email"]}', '{}', now() + (u.n || ' seconds')::interval, now()
from (values
  (1, 'a1000000-0000-4000-8000-0000000000a1', 'admin@s3-a.test'),
  (2, 'a1000000-0000-4000-8000-0000000000a2', 'finance@s3-a.test'),
  (3, 'a1000000-0000-4000-8000-0000000000a3', 'sales@s3-a.test'),
  (4, 'a1000000-0000-4000-8000-0000000000a4', 'ops@s3-a.test'),
  (5, 'a1000000-0000-4000-8000-0000000000a5', 'viewer@s3-a.test'),
  (6, 'b1000000-0000-4000-8000-0000000000b1', 'admin@s3-b.test')
) as u(n, id, email)
order by u.n;

update public.organization_members set capabilities = '{finance_access}' where user_id = 'a1000000-0000-4000-8000-0000000000a2';
update public.organization_members set capabilities = '{sales_access}' where user_id = 'a1000000-0000-4000-8000-0000000000a3';
update public.organization_members set capabilities = '{operations_access}' where user_id = 'a1000000-0000-4000-8000-0000000000a4';

insert into public.projects (id, organization_id, name, budget, start_date, end_date, created_by) values
  ('a1000000-0000-4000-8000-0000000000e1', 'a1000000-0000-4000-8000-00000000000a', 'S3 project', 1000, '2027-03-01', '2027-03-05', 'a1000000-0000-4000-8000-0000000000a1'),
  ('b1000000-0000-4000-8000-0000000000e1', 'b1000000-0000-4000-8000-00000000000b', 'S3 project B', 500, null, null, 'b1000000-0000-4000-8000-0000000000b1');
insert into public.project_members (project_id, user_id, role) values
  ('a1000000-0000-4000-8000-0000000000e1', 'a1000000-0000-4000-8000-0000000000a2', 'viewer'),
  ('a1000000-0000-4000-8000-0000000000e1', 'a1000000-0000-4000-8000-0000000000a3', 'editor'),
  ('a1000000-0000-4000-8000-0000000000e1', 'a1000000-0000-4000-8000-0000000000a5', 'viewer');

insert into public.milestones (project_id, title, due_date, created_by) values
  ('a1000000-0000-4000-8000-0000000000e1', 'S3 milestone', '2027-03-02', 'a1000000-0000-4000-8000-0000000000a1');
insert into public.invoices (project_id, title, amount, status, due_date, created_by) values
  ('a1000000-0000-4000-8000-0000000000e1', 'S3 invoice', 400, 'paid', '2027-03-03', 'a1000000-0000-4000-8000-0000000000a1');
insert into public.expenses (project_id, label, amount, created_by) values
  ('a1000000-0000-4000-8000-0000000000e1', 'S3 expense', 150, 'a1000000-0000-4000-8000-0000000000a1');
insert into public.rfqs (id, project_id, title, status, created_by) values
  ('a1000000-0000-4000-8000-0000000000f1', 'a1000000-0000-4000-8000-0000000000e1', 'S3 RFQ', 'awarded', 'a1000000-0000-4000-8000-0000000000a1');
insert into public.quotes (rfq_id, project_id, supplier_name, amount, status, created_by) values
  ('a1000000-0000-4000-8000-0000000000f1', 'a1000000-0000-4000-8000-0000000000e1', 'S3 supplier', 90, 'accepted', 'a1000000-0000-4000-8000-0000000000a1');
insert into public.documents (organization_id, project_id, title, storage_path, file_name, size_bytes, is_confidential, created_by) values
  ('a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000000e1', 'S3 drawing',
   'a1000000-0000-4000-8000-00000000000a/a1000000-0000-4000-8000-0000000000e1/d1/drawing.pdf', 'drawing.pdf', 10, false, 'a1000000-0000-4000-8000-0000000000a1'),
  ('a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000000e1', 'S3 priced contract',
   'a1000000-0000-4000-8000-00000000000a/a1000000-0000-4000-8000-0000000000e1/d2/contract.pdf', 'contract.pdf', 10, true, 'a1000000-0000-4000-8000-0000000000a1');

-- An uploaded file whose document row was never created (the insert failed), owned by a3.
insert into storage.objects (bucket_id, name, owner_id) values
  ('documents', 'a1000000-0000-4000-8000-00000000000a/a1000000-0000-4000-8000-0000000000e1/d9/orphan.pdf', 'a1000000-0000-4000-8000-0000000000a3');

set constraints all immediate;
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 1. Settings and audit
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select lives_ok($$ update public.organizations set timezone = 'Asia/Dubai', default_vat_rate = 5, tax_number = '300000000000003'
  where id = 'a1000000-0000-4000-8000-00000000000a' $$, 'admin updates organisation settings');
select throws_ok($$ update public.organizations set timezone = 'Mars/Olympus' where id = 'a1000000-0000-4000-8000-00000000000a' $$,
  '22023', null, 'an unknown time zone is rejected');
select lives_ok($$ update public.organization_members set capabilities = '{operations_access}'
  where user_id = 'a1000000-0000-4000-8000-0000000000a5' $$, 'admin grants a capability');
select ok((select count(*) from public.organization_audit where action = 'capabilities_changed'
  and target_user_id = 'a1000000-0000-4000-8000-0000000000a5') = 1, 'capability change is audited');
select ok((select count(*) from public.organization_audit where action = 'settings_changed') = 1, 'settings change is audited');
select ok((select details -> 'changed' ? 'timezone' from public.organization_audit where action = 'settings_changed'), 'audit lists the changed setting');
select is((select actor_id from public.organization_audit where action = 'capabilities_changed'
  and target_user_id = 'a1000000-0000-4000-8000-0000000000a5'),
  'a1000000-0000-4000-8000-0000000000a1'::uuid, 'audit records who made the change');
select throws_ok($$ insert into public.organization_audit (organization_id, action) values ('a1000000-0000-4000-8000-00000000000a', 'member_added') $$,
  '42501', null, 'nobody can write audit rows directly');
-- Undo the grant so the viewer stays a viewer for the tests below.
update public.organization_members set capabilities = '{}' where user_id = 'a1000000-0000-4000-8000-0000000000a5';

set local "request.jwt.claims" to '{"sub":"a1000000-0000-4000-8000-0000000000a5","role":"authenticated"}';
select is((select count(*) from public.organization_audit), 0::bigint, 'non-admins cannot read the audit trail');
select results_eq($$ with u as (update public.organizations set name = 'hijacked' where id = 'a1000000-0000-4000-8000-00000000000a' returning 1)
  select count(*)::int from u $$, $$ values (0) $$, 'non-admins cannot change settings');

set local "request.jwt.claims" to '{"sub":"b1000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is((select count(*) from public.organization_audit where organization_id = 'a1000000-0000-4000-8000-00000000000a'), 0::bigint,
  'another organisation''s admin cannot read this audit trail');

-- ---------------------------------------------------------------------------
-- 2. Calendar
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"a1000000-0000-4000-8000-0000000000a5","role":"authenticated"}';
select throws_ok($$ insert into public.calendar_events (organization_id, title, starts_at, ends_at)
  values ('a1000000-0000-4000-8000-00000000000a', 'x', now(), now() + interval '1 hour') $$, '42501', null,
  'a viewer cannot create organisation-wide events');
select throws_ok($$ insert into public.calendar_events (organization_id, project_id, title, starts_at, ends_at)
  values ('a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000000e1', 'x', now(), now() + interval '1 hour') $$,
  '42501', null, 'a project viewer cannot create project events');

set local "request.jwt.claims" to '{"sub":"a1000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
select lives_ok($$ insert into public.calendar_events (organization_id, title, kind, starts_at, ends_at)
  values ('a1000000-0000-4000-8000-00000000000a', 'S3 supplier meeting', 'meeting', '2027-03-01 09:00+03', '2027-03-01 10:00+03') $$,
  'operations creates an organisation-wide event');

set local "request.jwt.claims" to '{"sub":"a1000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
select lives_ok($$ insert into public.calendar_events (organization_id, project_id, title, kind, starts_at, ends_at)
  values ('a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000000e1', 'S3 site visit', 'site_visit', '2027-03-02 08:00+03', '2027-03-02 11:00+03') $$,
  'a project editor creates a project event');
select throws_ok($$ insert into public.calendar_events (organization_id, title, starts_at, ends_at)
  values ('a1000000-0000-4000-8000-00000000000a', 'x', '2027-03-02 10:00+03', '2027-03-02 09:00+03') $$, '23514', null,
  'an event cannot end before it starts');
select ok((select count(*) from public.calendar_feed('a1000000-0000-4000-8000-00000000000a', '2027-03-01', '2027-03-31')
  where source in ('event', 'project', 'milestone')) = 4, 'sales sees events, the project span and the milestone in the feed');
select is((select count(*) from public.calendar_feed('a1000000-0000-4000-8000-00000000000a', '2027-03-01', '2027-03-31') where source = 'invoice'),
  0::bigint, 'sales does not see invoice due dates in the feed');
select is((select start_date from public.calendar_feed('a1000000-0000-4000-8000-00000000000a', '2027-03-01', '2027-03-31') where title = 'S3 site visit'),
  '2027-03-02'::date, 'timed events carry their date in the organisation time zone');

set local "request.jwt.claims" to '{"sub":"a1000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select is((select count(*) from public.calendar_feed('a1000000-0000-4000-8000-00000000000a', '2027-03-01', '2027-03-31') where source = 'invoice'),
  1::bigint, 'finance sees invoice due dates in the feed');

set local "request.jwt.claims" to '{"sub":"b1000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is((select count(*) from public.calendar_feed('a1000000-0000-4000-8000-00000000000a', '2027-03-01', '2027-03-31')), 0::bigint,
  'another organisation sees nothing in this feed');

-- Even someone who may edit the project cannot file its event under another organisation.
set local "request.jwt.claims" to '{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select throws_ok($$ insert into public.calendar_events (organization_id, project_id, title, starts_at, ends_at)
  values ('b1000000-0000-4000-8000-00000000000b', 'a1000000-0000-4000-8000-0000000000e1', 'x', now(), now()) $$, '23503', null,
  'an event cannot point at another organisation''s project');

-- ---------------------------------------------------------------------------
-- 3. Documents
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"a1000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
select is((select count(*) from public.documents), 1::bigint, 'a non-finance member sees only the non-confidential document');
select lives_ok($$ insert into public.documents (organization_id, project_id, title, storage_path, file_name, size_bytes)
  values ('a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000000e1', 'S3 permit',
          'a1000000-0000-4000-8000-00000000000a/a1000000-0000-4000-8000-0000000000e1/d3/permit.pdf', 'permit.pdf', 10) $$,
  'a project editor adds a document');
select throws_ok($$ insert into public.documents (organization_id, project_id, title, storage_path, file_name, size_bytes, is_confidential)
  values ('a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000000e1', 'x',
          'a1000000-0000-4000-8000-00000000000a/a1000000-0000-4000-8000-0000000000e1/d4/x.pdf', 'x.pdf', 10, true) $$,
  '42501', null, 'a non-finance editor cannot add a confidential document');
select throws_ok($$ insert into public.documents (organization_id, project_id, title, storage_path, file_name, size_bytes)
  values ('a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000000e1', 'x',
          'b1000000-0000-4000-8000-00000000000b/org/d5/x.pdf', 'x.pdf', 10) $$,
  '23514', null, 'the storage path must sit under the document''s own folder');
select ok((select private.can_write_document_path('a1000000-0000-4000-8000-00000000000a/a1000000-0000-4000-8000-0000000000e1/new/f.pdf')),
  'a project editor may upload into the project folder');
select ok((select private.can_write_document_path('a1000000-0000-4000-8000-00000000000a/org/new/f.pdf')),
  'a member with a working capability may upload organisation documents');

set local "request.jwt.claims" to '{"sub":"a1000000-0000-4000-8000-0000000000a5","role":"authenticated"}';
select ok(not (select private.can_write_document_path('a1000000-0000-4000-8000-00000000000a/org/new/f.pdf')),
  'a viewer cannot upload organisation documents');
select ok(not (select private.can_write_document_path('not-a-uuid/org/f.pdf')), 'malformed paths are refused');

set local "request.jwt.claims" to '{"sub":"a1000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select is((select count(*) from public.documents where is_confidential), 1::bigint, 'finance sees the confidential document');

set local "request.jwt.claims" to '{"sub":"b1000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is((select count(*) from public.documents), 0::bigint, 'another organisation sees no documents');
select ok(not (select private.can_write_document_path('a1000000-0000-4000-8000-00000000000a/a1000000-0000-4000-8000-0000000000e1/x/f.pdf')),
  'another organisation cannot upload into this project folder');

-- ---------------------------------------------------------------------------
-- 4. Reports
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"a1000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
select is((select count(*) from public.report_project_finance('a1000000-0000-4000-8000-00000000000a')), 0::bigint,
  'sales gets no finance report rows');
select is((select quotes from public.report_procurement('a1000000-0000-4000-8000-00000000000a')), null::bigint,
  'sales gets no quote figures in the procurement report');
select is((select projects from public.report_pipeline('a1000000-0000-4000-8000-00000000000a')), 1::bigint,
  'sales sees the projects it belongs to in the pipeline');

set local "request.jwt.claims" to '{"sub":"a1000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select results_eq($$ select invoiced, paid, expenses, margin from public.report_project_finance('a1000000-0000-4000-8000-00000000000a') $$,
  $$ values (400::numeric, 400::numeric, 150::numeric, 250::numeric) $$, 'finance gets correct project finance figures');
select is((select awarded_value from public.report_procurement('a1000000-0000-4000-8000-00000000000a')), 90::numeric,
  'finance sees the awarded quote value');

-- ---------------------------------------------------------------------------
-- 5. Hardening: confidential activity, public mail domains, local "today" in reports
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"a1000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
select is((select count(*) from public.activity where entity_type = 'documents' and details::text like '%priced contract%'), 0::bigint,
  'a confidential document title never appears in the activity feed');
select is((select count(*) from public.activity where entity_type = 'documents' and (details ->> 'confidential')::boolean), 0::bigint,
  'a non-finance member does not see activity lines about confidential documents');
select ok((select count(*) from public.activity where entity_type = 'documents' and details ->> 'label' = 'S3 drawing') = 1,
  'ordinary document activity stays visible to project members');

set local "request.jwt.claims" to '{"sub":"a1000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select ok((select count(*) from public.activity
           where entity_type = 'documents' and (details ->> 'confidential')::boolean and details ->> 'label' = 'مستند سري') = 1,
  'finance sees the confidential document line, with the title masked');

set local "request.jwt.claims" to '{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select throws_ok($$ insert into public.organization_domains (domain, organization_id) values ('gmail.com', 'a1000000-0000-4000-8000-00000000000a') $$,
  '23514', null, 'a public mailbox provider cannot become an auto-join domain');

-- A zone whose date differs from UTC's right now, so a UTC-based "today" would give a wrong answer.
select lives_ok($$ update public.organizations
  set timezone = case when extract(hour from now() at time zone 'UTC') >= 11 then 'Pacific/Kiritimati' else 'Pacific/Pago_Pago' end
  where id = 'a1000000-0000-4000-8000-00000000000a' $$, 'the admin sets a far-off organisation time zone');
select lives_ok($$ insert into public.tasks (project_id, title, status, due_date) values
  ('a1000000-0000-4000-8000-0000000000e1', 'S3 due yesterday (local)', 'todo', (now() at time zone (select timezone from public.organizations where id = 'a1000000-0000-4000-8000-00000000000a'))::date - 1),
  ('a1000000-0000-4000-8000-0000000000e1', 'S3 due today (local)', 'todo', (now() at time zone (select timezone from public.organizations where id = 'a1000000-0000-4000-8000-00000000000a'))::date) $$,
  'two tasks: due yesterday and today in the organisation''s time zone');
select is((select tasks_overdue from public.report_delivery('a1000000-0000-4000-8000-00000000000a') where project_id = 'a1000000-0000-4000-8000-0000000000e1'), 1::bigint,
  'the delivery report counts overdue tasks by the organisation''s local date');

set local "request.jwt.claims" to '{"sub":"a1000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
select is((select count(*) from storage.objects where bucket_id = 'documents' and name like '%/d9/orphan.pdf'), 1::bigint,
  'an uploader sees their own unclaimed object, so cleanup after a failed insert can remove it');
set local "request.jwt.claims" to '{"sub":"a1000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select is((select count(*) from storage.objects where bucket_id = 'documents' and name like '%/d9/orphan.pdf'), 0::bigint,
  'another member does not see someone else''s unclaimed upload');

reset role;
select * from finish();
rollback;
