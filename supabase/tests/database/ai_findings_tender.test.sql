-- Shared AI findings (source traceability, human review) and the tender requirements register.
-- Acts as real users through request.jwt.claims; synthetic .test data; rolls back.

begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- ---------------------------------------------------------------------------
-- Fixture
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, email_domain) values
  ('a4000000-0000-4000-8000-00000000000a', 'AI Org A', 'ai-a.test'),
  ('b4000000-0000-4000-8000-00000000000b', 'AI Org B', 'ai-b.test');
insert into public.organization_domains (domain, organization_id) values
  ('ai-a.test', 'a4000000-0000-4000-8000-00000000000a'),
  ('ai-b.test', 'b4000000-0000-4000-8000-00000000000b');
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email, now(),
       '{"provider":"email","providers":["email"]}', '{}', now() + (u.n || ' seconds')::interval, now()
from (values
  (1, 'a4000000-0000-4000-8000-0000000000a1', 'admin@ai-a.test'),
  (2, 'a4000000-0000-4000-8000-0000000000a2', 'finance@ai-a.test'),
  (3, 'a4000000-0000-4000-8000-0000000000a3', 'sales@ai-a.test'),
  (4, 'a4000000-0000-4000-8000-0000000000a5', 'viewer@ai-a.test'),
  (5, 'b4000000-0000-4000-8000-0000000000b1', 'admin@ai-b.test')
) as u(n, id, email) order by u.n;
update public.organization_members set capabilities = '{finance_access}' where user_id = 'a4000000-0000-4000-8000-0000000000a2';
update public.organization_members set capabilities = '{sales_access}' where user_id = 'a4000000-0000-4000-8000-0000000000a3';

insert into public.projects (id, organization_id, name, created_by) values
  ('a4000000-0000-4000-8000-0000000000e1', 'a4000000-0000-4000-8000-00000000000a', 'AI tender project', 'a4000000-0000-4000-8000-0000000000a1');
insert into public.project_members (project_id, user_id, role) values
  ('a4000000-0000-4000-8000-0000000000e1', 'a4000000-0000-4000-8000-0000000000a2', 'viewer'),
  ('a4000000-0000-4000-8000-0000000000e1', 'a4000000-0000-4000-8000-0000000000a3', 'editor'),
  ('a4000000-0000-4000-8000-0000000000e1', 'a4000000-0000-4000-8000-0000000000a5', 'viewer');
insert into public.documents (id, organization_id, project_id, title, storage_path, file_name, size_bytes, created_by) values
  ('a4000000-0000-4000-8000-0000000000d1', 'a4000000-0000-4000-8000-00000000000a', 'a4000000-0000-4000-8000-0000000000e1', 'Tender booklet',
   'a4000000-0000-4000-8000-00000000000a/a4000000-0000-4000-8000-0000000000e1/a4000000-0000-4000-8000-0000000000d1/tender.pdf', 'tender.pdf', 10, 'a4000000-0000-4000-8000-0000000000a1'),
  ('a4000000-0000-4000-8000-0000000000d2', 'a4000000-0000-4000-8000-00000000000a', 'a4000000-0000-4000-8000-0000000000e1', 'Commercial registration',
   'a4000000-0000-4000-8000-00000000000a/a4000000-0000-4000-8000-0000000000e1/a4000000-0000-4000-8000-0000000000d2/cr.pdf', 'cr.pdf', 10, 'a4000000-0000-4000-8000-0000000000a1');
insert into public.projects (id, organization_id, name, created_by) values
  ('b4000000-0000-4000-8000-0000000000e1', 'b4000000-0000-4000-8000-00000000000b', 'Other org project', 'b4000000-0000-4000-8000-0000000000b1');
insert into public.documents (id, organization_id, project_id, title, storage_path, file_name, size_bytes, created_by) values
  ('b4000000-0000-4000-8000-0000000000d1', 'b4000000-0000-4000-8000-00000000000b', 'b4000000-0000-4000-8000-0000000000e1', 'Other doc',
   'b4000000-0000-4000-8000-00000000000b/b4000000-0000-4000-8000-0000000000e1/b4000000-0000-4000-8000-0000000000d1/x.pdf', 'x.pdf', 10, 'b4000000-0000-4000-8000-0000000000b1');

set constraints all immediate;
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Findings: created as proposals, provenance permanent, review stamped by the database
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"a4000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
select lives_ok($$ insert into public.ai_usage_logs (organization_id, feature, provider, request_hash)
  values ('a4000000-0000-4000-8000-00000000000a', 'tender_analysis', 'mock', repeat('d', 64)) $$, 'tender analysis is a logged AI feature');
select lives_ok($$ insert into public.ai_findings (id, organization_id, project_id, document_id, workflow, kind, title, detail, severity,
    status, reviewed_by, source_page, source_excerpt, source_verified, data)
  values ('a4000000-0000-4000-8000-0000000000f1', 'a4000000-0000-4000-8000-00000000000a', 'a4000000-0000-4000-8000-0000000000e1',
    'a4000000-0000-4000-8000-0000000000d1', 'tender', 'mandatory_document', 'Valid commercial registration', 'Submit a copy', 'warning',
    'accepted', 'a4000000-0000-4000-8000-0000000000a1', 3, 'A valid commercial registration must be attached', true,
    '{"category":"document","due_date":"2027-05-01","mandatory":true}') $$,
  'a project editor records an AI finding with its source');
select ok((select status = 'proposed' and reviewed_by is null from public.ai_findings where id = 'a4000000-0000-4000-8000-0000000000f1'),
  'a new finding is always a proposal, whatever the client sends');
select throws_ok($$ insert into public.ai_findings (organization_id, project_id, workflow, kind, title, created_by)
  values ('a4000000-0000-4000-8000-00000000000a', 'a4000000-0000-4000-8000-0000000000e1', 'tender', 'requirement', 'x', 'a4000000-0000-4000-8000-0000000000a1') $$,
  '42501', null, 'nobody records findings on someone else''s behalf');
select throws_ok($$ update public.ai_findings set source_excerpt = 'edited' where id = 'a4000000-0000-4000-8000-0000000000f1' $$,
  '42501', null, 'the source excerpt cannot be edited');
select throws_ok($$ update public.ai_findings set title = 'Better title' where id = 'a4000000-0000-4000-8000-0000000000f1' $$,
  '42501', null, 'what the AI proposed cannot be rewritten');
select throws_ok($$ update public.ai_findings set reviewed_by = 'a4000000-0000-4000-8000-0000000000a1' where id = 'a4000000-0000-4000-8000-0000000000f1' $$,
  '42501', null, 'review details cannot be written without a decision');

select ok((select public.accept_finding_as_requirement('a4000000-0000-4000-8000-0000000000f1', 'Needed') is not null),
  'accepting a tender finding creates a register row');
select ok((select r.category = 'document' and r.due_date = '2027-05-01' and r.mandatory and r.status = 'open'
             and r.source_ref = 'Tender booklet · صفحة 3' and r.finding_id = 'a4000000-0000-4000-8000-0000000000f1'
           from public.project_requirements r where r.title = 'Valid commercial registration'),
  'the register row carries category, due date and its source');
select ok((select f.status = 'accepted' and f.reviewed_by = 'a4000000-0000-4000-8000-0000000000a3' and f.reviewed_at is not null
             and f.target_table = 'project_requirements'
             and f.target_id = (select id from public.project_requirements where title = 'Valid commercial registration')
           from public.ai_findings f where f.id = 'a4000000-0000-4000-8000-0000000000f1'),
  'the finding records who accepted it, when, and what it became');
select throws_ok($$ select public.accept_finding_as_requirement('a4000000-0000-4000-8000-0000000000f1') $$,
  '22023', null, 'a finding is decided once');

select lives_ok($$ insert into public.ai_findings (id, organization_id, project_id, workflow, kind, title, severity)
  values ('a4000000-0000-4000-8000-0000000000f2', 'a4000000-0000-4000-8000-00000000000a', 'a4000000-0000-4000-8000-0000000000e1',
    'tender', 'contradiction', 'Two different submission dates', 'critical') $$, 'a second finding');
select lives_ok($$ update public.ai_findings set status = 'rejected', review_note = 'Same date in the addendum'
  where id = 'a4000000-0000-4000-8000-0000000000f2' $$, 'a finding can be rejected with a note');
select ok((select reviewed_by = 'a4000000-0000-4000-8000-0000000000a3' from public.ai_findings where id = 'a4000000-0000-4000-8000-0000000000f2'),
  'rejection is stamped with the reviewer');
select throws_ok($$ update public.ai_findings set status = 'accepted' where id = 'a4000000-0000-4000-8000-0000000000f2' $$,
  '22023', null, 'a decision is changed only by reopening first');
select lives_ok($$ update public.ai_findings set status = 'proposed' where id = 'a4000000-0000-4000-8000-0000000000f2' $$, 'a finding can be reopened');
select ok((select reviewed_by is null and review_note = '' from public.ai_findings where id = 'a4000000-0000-4000-8000-0000000000f2'),
  'reopening clears the earlier decision');
select throws_ok($$ insert into public.ai_findings (organization_id, project_id, workflow, kind, title, finance_only)
  values ('a4000000-0000-4000-8000-00000000000a', 'a4000000-0000-4000-8000-0000000000e1', 'pricing', 'below_cost', 'x', true) $$,
  '42501', null, 'without finance access, no finance findings can be recorded');

-- ---------------------------------------------------------------------------
-- Register rules
-- ---------------------------------------------------------------------------
select throws_ok($$ update public.project_requirements set owner_id = 'b4000000-0000-4000-8000-0000000000b1'
  where title = 'Valid commercial registration' $$, '23514', null, 'the owner must belong to the project or organisation');
select throws_ok($$ update public.project_requirements set document_id = 'b4000000-0000-4000-8000-0000000000d1'
  where title = 'Valid commercial registration' $$, '23503', null, 'evidence must be a document of the same organisation');
select lives_ok($$ update public.project_requirements set document_id = 'a4000000-0000-4000-8000-0000000000d2', status = 'met',
  owner_id = 'a4000000-0000-4000-8000-0000000000a3' where title = 'Valid commercial registration' $$,
  'the editor links evidence, sets the owner and marks it met');
select is((select count(*) from public.calendar_feed('a4000000-0000-4000-8000-00000000000a', '2027-05-01', '2027-05-31') where source = 'requirement'),
  1::bigint, 'requirement due dates appear in the calendar');
select ok((select count(*) from public.activity where entity_type = 'project_requirements') >= 1, 'register changes appear in the activity log');

-- ---------------------------------------------------------------------------
-- Other roles and organisations
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"a4000000-0000-4000-8000-0000000000a5","role":"authenticated"}';
select ok((select count(*) from public.ai_findings) = 2 and (select count(*) from public.project_requirements) = 1,
  'a project viewer reads findings and the register');
select throws_ok($$ insert into public.ai_findings (organization_id, project_id, workflow, kind, title)
  values ('a4000000-0000-4000-8000-00000000000a', 'a4000000-0000-4000-8000-0000000000e1', 'tender', 'requirement', 'x') $$,
  '42501', null, 'a viewer cannot record findings');
select throws_ok($$ select public.accept_finding_as_requirement('a4000000-0000-4000-8000-0000000000f2') $$,
  '42501', null, 'a viewer cannot accept findings');
select results_eq($$ with u as (update public.project_requirements set status = 'open' returning 1) select count(*)::int from u $$,
  $$ values (0) $$, 'a viewer cannot change the register');

set local "request.jwt.claims" to '{"sub":"a4000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select lives_ok($$ insert into public.ai_findings (id, organization_id, project_id, workflow, kind, title, finance_only)
  values ('a4000000-0000-4000-8000-0000000000f3', 'a4000000-0000-4000-8000-00000000000a', 'a4000000-0000-4000-8000-0000000000e1',
    'pricing', 'below_cost', 'Stage priced below cost', true) $$, 'the admin records a finance-only finding');

set local "request.jwt.claims" to '{"sub":"a4000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
select is((select count(*) from public.ai_findings where finance_only), 0::bigint, 'an editor without finance access cannot see finance findings');
select lives_ok($$ delete from public.documents where id = 'a4000000-0000-4000-8000-0000000000d1' $$,
  'deleting a source document is not blocked by the finding that cites it');

set local "request.jwt.claims" to '{"sub":"a4000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select is((select count(*) from public.ai_findings where finance_only), 1::bigint, 'a finance member of the project sees finance findings');

set local "request.jwt.claims" to '{"sub":"b4000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select ok((select count(*) from public.ai_findings) = 0 and (select count(*) from public.project_requirements) = 0,
  'another organisation sees no findings and no register');

reset role;
select * from finish();
rollback;
