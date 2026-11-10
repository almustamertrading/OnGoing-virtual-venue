-- Workflow B: AI-extracted BOQ lines join the BOQ only through a project editor's acceptance (the human
-- verification of the quantity), in one transaction; finding links stay inside their project.
-- Acts as real users through request.jwt.claims; synthetic .test data; rolls back.

begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into public.organizations (id, name, email_domain) values
  ('e8000000-0000-4000-8000-00000000000a', 'BOQ Org', 'boqx-a.test');
insert into public.organization_domains (domain, organization_id) values ('boqx-a.test', 'e8000000-0000-4000-8000-00000000000a');
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email, now(),
       '{"provider":"email","providers":["email"]}', '{}', now() + (u.n || ' seconds')::interval, now()
from (values
  (1, 'e8000000-0000-4000-8000-0000000000a1', 'admin@boqx-a.test'),
  (2, 'e8000000-0000-4000-8000-0000000000a2', 'estimator@boqx-a.test'),
  (3, 'e8000000-0000-4000-8000-0000000000a3', 'viewer@boqx-a.test')
) as u(n, id, email) order by u.n;
update public.organization_members set capabilities = '{sales_access}' where user_id = 'e8000000-0000-4000-8000-0000000000a2';
insert into public.projects (id, organization_id, name, created_by) values
  ('e8000000-0000-4000-8000-0000000000e1', 'e8000000-0000-4000-8000-00000000000a', 'BOQ project', 'e8000000-0000-4000-8000-0000000000a1'),
  ('e8000000-0000-4000-8000-0000000000e2', 'e8000000-0000-4000-8000-00000000000a', 'Other project', 'e8000000-0000-4000-8000-0000000000a1');
insert into public.project_members (project_id, user_id, role) values
  ('e8000000-0000-4000-8000-0000000000e1', 'e8000000-0000-4000-8000-0000000000a2', 'editor'),
  ('e8000000-0000-4000-8000-0000000000e1', 'e8000000-0000-4000-8000-0000000000a3', 'viewer'),
  ('e8000000-0000-4000-8000-0000000000e2', 'e8000000-0000-4000-8000-0000000000a2', 'editor');
insert into public.documents (id, organization_id, project_id, title, storage_path, file_name, size_bytes, created_by) values
  ('e8000000-0000-4000-8000-0000000000d1', 'e8000000-0000-4000-8000-00000000000a', 'e8000000-0000-4000-8000-0000000000e1', 'Tender BOQ',
   'e8000000-0000-4000-8000-00000000000a/e8000000-0000-4000-8000-0000000000e1/e8000000-0000-4000-8000-0000000000d1/boq.pdf', 'boq.pdf', 10, 'e8000000-0000-4000-8000-0000000000a1');
-- A finding in the other project, for the link checks.
insert into public.ai_findings (id, organization_id, project_id, workflow, kind, title, created_by) values
  ('e8000000-0000-4000-8000-0000000000f9', 'e8000000-0000-4000-8000-00000000000a', 'e8000000-0000-4000-8000-0000000000e2', 'boq', 'boq_line',
   'Other project line', 'e8000000-0000-4000-8000-0000000000a1');

set constraints all immediate;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"e8000000-0000-4000-8000-0000000000a2","role":"authenticated"}';

select lives_ok($$ insert into public.ai_usage_logs (organization_id, feature, provider, request_hash)
  values ('e8000000-0000-4000-8000-00000000000a', 'boq_extract', 'mock', repeat('b', 64)) $$, 'BOQ extraction is a logged AI feature');
select lives_ok($$ insert into public.ai_findings (id, organization_id, project_id, document_id, workflow, kind, title, source_page, source_excerpt, source_verified, data, created_by) values
  ('e8000000-0000-4000-8000-0000000000f1', 'e8000000-0000-4000-8000-00000000000a', 'e8000000-0000-4000-8000-0000000000e1', 'e8000000-0000-4000-8000-0000000000d1',
   'boq', 'boq_line', 'LED screen 3x2m', 2, '1.1 LED screen 3x2m 2 nos', true, '{"item_ref":"1.1","unit":"nos","quantity":"2"}', 'e8000000-0000-4000-8000-0000000000a2'),
  ('e8000000-0000-4000-8000-0000000000f2', 'e8000000-0000-4000-8000-00000000000a', 'e8000000-0000-4000-8000-0000000000e1', 'e8000000-0000-4000-8000-0000000000d1',
   'boq', 'boq_line', 'Stage carpet as per drawing', 2, '1.3 Stage carpet as per drawing', true, '{"item_ref":"1.3","unit":"","quantity":""}', 'e8000000-0000-4000-8000-0000000000a2'),
  ('e8000000-0000-4000-8000-0000000000f3', 'e8000000-0000-4000-8000-00000000000a', 'e8000000-0000-4000-8000-0000000000e1', 'e8000000-0000-4000-8000-0000000000d1',
   'tender', 'requirement', 'Bid bond', 1, '', false, '{}', 'e8000000-0000-4000-8000-0000000000a2'),
  ('e8000000-0000-4000-8000-0000000000f4', 'e8000000-0000-4000-8000-00000000000a', 'e8000000-0000-4000-8000-0000000000e1', 'e8000000-0000-4000-8000-0000000000d1',
   'boq', 'boq_line', 'Truss 24 m', 2, '1.2 Truss 24 m', true, '{"item_ref":"1.2","unit":"m","quantity":"24"}', 'e8000000-0000-4000-8000-0000000000a2') $$,
  'the estimator records extracted BOQ lines');

-- ----- The viewer cannot verify -----
set local "request.jwt.claims" to '{"sub":"e8000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
select throws_ok($$ select public.accept_finding_as_boq_item('e8000000-0000-4000-8000-0000000000f1') $$, '42501', null,
  'a project viewer cannot verify an extracted line');

-- ----- The estimator verifies -----
set local "request.jwt.claims" to '{"sub":"e8000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select ok((select public.accept_finding_as_boq_item('e8000000-0000-4000-8000-0000000000f1', 'Checked against page 2') is not null),
  'an accepted line joins the BOQ');
select ok((select b.description = 'LED screen 3x2m' and b.unit = 'nos' and b.quantity = 2 and b.item_ref = '1.1'
             and b.source_ref = 'Tender BOQ · صفحة 2' and b.finding_id = 'e8000000-0000-4000-8000-0000000000f1' and b.unit_price is null
           from public.boq_items b where b.project_id = 'e8000000-0000-4000-8000-0000000000e1'),
  'the BOQ line keeps the extracted quantity, unit, item reference and source, and no price');
select ok((select status = 'accepted' and target_table = 'boq_items' and reviewed_by = 'e8000000-0000-4000-8000-0000000000a2'
             and review_note = 'Checked against page 2'
           from public.ai_findings where id = 'e8000000-0000-4000-8000-0000000000f1'),
  'the finding records who verified it, when, and what it became');
select throws_ok($$ select public.accept_finding_as_boq_item('e8000000-0000-4000-8000-0000000000f1') $$, '22023', null, 'a line is verified once');
select lives_ok($$ select public.accept_finding_as_boq_item('e8000000-0000-4000-8000-0000000000f2') $$, 'a line without a stated quantity can be accepted');
select ok((select quantity is null and sort_order > (select sort_order from public.boq_items where item_ref = '1.1')
           from public.boq_items where item_ref = '1.3'),
  'a missing quantity stays empty (never guessed), and the line goes to the end of the BOQ');
select throws_ok($$ select public.accept_finding_as_boq_item('e8000000-0000-4000-8000-0000000000f3') $$, '22023', null,
  'a tender requirement does not become a BOQ line');

-- ----- Finding links stay inside the project -----
select throws_ok($$ insert into public.boq_items (project_id, description, finding_id)
  values ('e8000000-0000-4000-8000-0000000000e1', 'Smuggled link', 'e8000000-0000-4000-8000-0000000000f9') $$,
  '23514', null, 'a BOQ line cannot link to another project''s finding');
select throws_ok($$ insert into public.project_requirements (project_id, organization_id, title, finding_id)
  values ('e8000000-0000-4000-8000-0000000000e1', 'e8000000-0000-4000-8000-00000000000a', 'Smuggled', 'e8000000-0000-4000-8000-0000000000f9') $$,
  '23514', null, 'a requirement cannot link to another project''s finding');
select lives_ok($$ insert into public.boq_items (project_id, description, finding_id)
  values ('e8000000-0000-4000-8000-0000000000e1', 'Manual line from the same analysis', 'e8000000-0000-4000-8000-0000000000f4') $$,
  'a link to a finding of the same project is allowed');

-- ----- Deleting the finding keeps the verified line -----
set local "request.jwt.claims" to '{"sub":"e8000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
delete from public.ai_findings where id = 'e8000000-0000-4000-8000-0000000000f1';
select ok((select finding_id is null and quantity = 2 from public.boq_items where item_ref = '1.1'),
  'removing the finding keeps the verified BOQ line');

select * from finish();
rollback;
