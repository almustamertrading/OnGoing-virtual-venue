-- Proposal Builder Phase 2 + AI usage log: workflow gate (no forged approvals, re-approval after
-- re-submission), versions without costs, reviews, templates, content lock, atomic conversion to a
-- project, usage-log integrity. Acts as real users; rolls back.

begin;
create extension if not exists pgtap with schema extensions;
select plan(59);

insert into public.organizations (id, name, email_domain) values
  ('a2000000-0000-4000-8000-00000000000a', 'P2 Org', 'p2.test'),
  ('b2000000-0000-4000-8000-00000000000b', 'P2 Other', 'p2-other.test');
insert into public.organization_domains (domain, organization_id) values
  ('p2.test', 'a2000000-0000-4000-8000-00000000000a'),
  ('p2-other.test', 'b2000000-0000-4000-8000-00000000000b');
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email, now(),
       '{"provider":"email","providers":["email"]}', '{}', now() + (u.n || ' seconds')::interval, now()
from (values
  (1, 'a2000000-0000-4000-8000-0000000000a1', 'admin@p2.test'),
  (2, 'a2000000-0000-4000-8000-0000000000a2', 'sales@p2.test'),
  (3, 'a2000000-0000-4000-8000-0000000000a3', 'viewer@p2.test'),
  (4, 'b2000000-0000-4000-8000-0000000000b1', 'admin@p2-other.test')
) as u(n, id, email) order by u.n;
update public.organization_members set capabilities = '{sales_access}' where user_id = 'a2000000-0000-4000-8000-0000000000a2';

insert into public.proposals (id, organization_id, title, created_by) values
  ('a2000000-0000-4000-8000-0000000000b1', 'a2000000-0000-4000-8000-00000000000a', 'P2 proposal', 'a2000000-0000-4000-8000-0000000000a2');
insert into public.proposal_sections (proposal_id, organization_id, heading, body, created_by) values
  ('a2000000-0000-4000-8000-0000000000b1', 'a2000000-0000-4000-8000-00000000000a', 'Scope', 'Body text', 'a2000000-0000-4000-8000-0000000000a2');
insert into public.proposal_items (id, proposal_id, organization_id, description, quantity, unit_price, created_by) values
  ('a2000000-0000-4000-8000-0000000000c1', 'a2000000-0000-4000-8000-0000000000b1', 'a2000000-0000-4000-8000-00000000000a', 'Stage', 1, 900, 'a2000000-0000-4000-8000-0000000000a2');
insert into public.proposal_item_costs (item_id, organization_id, unit_cost) values
  ('a2000000-0000-4000-8000-0000000000c1', 'a2000000-0000-4000-8000-00000000000a', 777);

set constraints all immediate;
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Workflow
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"a2000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select throws_ok($$ update public.proposals set status = 'sent_to_client' where id = 'a2000000-0000-4000-8000-0000000000b1' $$,
  '42501', null, 'sales cannot send a proposal that was never approved');
select lives_ok($$ update public.proposals set status = 'under_review' where id = 'a2000000-0000-4000-8000-0000000000b1' $$,
  'sales submits the proposal for review');
select is((select version from public.proposals where id = 'a2000000-0000-4000-8000-0000000000b1'), 2, 'submission starts version 2');
select is((select count(*) from public.proposal_versions where version = 1 and status = 'under_review'), 1::bigint,
  'submission froze version 1');
select ok((select submitted_at is not null from public.proposals where id = 'a2000000-0000-4000-8000-0000000000b1'), 'submission time recorded');
select ok((select snapshot::text not like '%777%' and snapshot::text not like '%unit_cost%' from public.proposal_versions where version = 1),
  'the frozen version never contains internal costs');
select ok((select snapshot -> 'items' -> 0 ->> 'unit_price' = '900.00' from public.proposal_versions where version = 1),
  'the frozen version keeps client prices');
select throws_ok($$ update public.proposals set status = 'approved_internally' where id = 'a2000000-0000-4000-8000-0000000000b1' $$,
  '42501', null, 'sales cannot approve');
select throws_ok($$ insert into public.proposal_reviews (proposal_id, organization_id, version, decision)
  values ('a2000000-0000-4000-8000-0000000000b1', 'a2000000-0000-4000-8000-00000000000a', 1, 'approved') $$,
  '42501', null, 'sales cannot record an approval');
select lives_ok($$ insert into public.proposal_reviews (proposal_id, organization_id, version, decision, comment)
  values ('a2000000-0000-4000-8000-0000000000b1', 'a2000000-0000-4000-8000-00000000000a', 1, 'comment', 'Please check pricing') $$,
  'sales can comment');

set local "request.jwt.claims" to '{"sub":"a2000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select throws_ok($$ insert into public.proposal_reviews (proposal_id, organization_id, version, decision)
  values ('a2000000-0000-4000-8000-0000000000b1', 'a2000000-0000-4000-8000-00000000000a', 1, 'changes_requested') $$,
  '23514', null, 'requesting changes needs a comment');
select lives_ok($$ insert into public.proposal_reviews (proposal_id, organization_id, version, decision, comment)
  values ('a2000000-0000-4000-8000-0000000000b1', 'a2000000-0000-4000-8000-00000000000a', 1, 'approved', 'Good to go') $$,
  'the admin approves through a review');
select is((select status::text from public.proposals where id = 'a2000000-0000-4000-8000-0000000000b1'), 'approved_internally',
  'approval moves the proposal to approved');
select is((select approved_by from public.proposals where id = 'a2000000-0000-4000-8000-0000000000b1'),
  'a2000000-0000-4000-8000-0000000000a1'::uuid, 'the approver is recorded');
select is((select count(*) from public.proposal_versions where status = 'approved_internally' and version = 2), 1::bigint,
  'approval froze version 2');
select throws_ok($$ insert into public.proposal_reviews (proposal_id, organization_id, version, decision)
  values ('a2000000-0000-4000-8000-0000000000b1', 'a2000000-0000-4000-8000-00000000000a', 2, 'approved') $$,
  '22023', null, 'only a proposal under review can be approved');

-- ---------------------------------------------------------------------------
-- Locked after approval
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"a2000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select results_eq($$ with u as (update public.proposal_sections set body = 'changed' returning 1) select count(*)::int from u $$,
  $$ values (0) $$, 'approved content: sections cannot be edited');
select throws_ok($$ insert into public.proposal_items (proposal_id, organization_id, description)
  values ('a2000000-0000-4000-8000-0000000000b1', 'a2000000-0000-4000-8000-00000000000a', 'late item') $$,
  '42501', null, 'approved content: items cannot be added');
select throws_ok($$ update public.proposals set title = 'renamed' where id = 'a2000000-0000-4000-8000-0000000000b1' $$,
  '42501', null, 'approved content: the header is locked');
select lives_ok($$ update public.proposals set status = 'sent_to_client' where id = 'a2000000-0000-4000-8000-0000000000b1' $$,
  'once approved, sales can send it');
select is((select count(*) from public.proposal_versions where status = 'sent_to_client'), 1::bigint, 'sending froze a version');
select lives_ok($$ update public.proposals set status = 'draft' where id = 'a2000000-0000-4000-8000-0000000000b1' $$,
  'moving back to draft is allowed');
select ok((select approved_at is null from public.proposals where id = 'a2000000-0000-4000-8000-0000000000b1'),
  'going back to draft clears the approval');

-- ---------------------------------------------------------------------------
-- Versions are immutable; manual versions need sales
-- ---------------------------------------------------------------------------
select throws_ok($$ insert into public.proposal_versions (proposal_id, organization_id, version, status, snapshot)
  values ('a2000000-0000-4000-8000-0000000000b1', 'a2000000-0000-4000-8000-00000000000a', 99, 'draft', '{}') $$,
  '42501', null, 'versions cannot be written directly');
select throws_ok($$ delete from public.proposal_versions $$, '42501', null, 'versions cannot be deleted');
select ok((select public.save_proposal_version('a2000000-0000-4000-8000-0000000000b1', 'manual checkpoint') >= 4),
  'sales saves a manual version');

set local "request.jwt.claims" to '{"sub":"a2000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
select throws_ok($$ select public.save_proposal_version('a2000000-0000-4000-8000-0000000000b1', 'x') $$,
  '42501', null, 'a viewer cannot save versions');
select ok((select count(*) from public.proposal_versions) >= 4, 'viewers can read the version history');
select throws_ok($$ insert into public.proposal_templates (organization_id, name) values ('a2000000-0000-4000-8000-00000000000a', 'x') $$,
  '42501', null, 'a viewer cannot create templates');

set local "request.jwt.claims" to '{"sub":"b2000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is((select count(*) from public.proposal_versions), 0::bigint, 'another organisation sees no versions');

-- ---------------------------------------------------------------------------
-- Workflow fields cannot be forged; review locks content; re-submission needs re-approval
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"a2000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select throws_ok($$ update public.proposals set approved_at = now(), approved_by = 'a2000000-0000-4000-8000-0000000000a1' where id = 'a2000000-0000-4000-8000-0000000000b1' $$,
  '42501', null, 'sales cannot write the approval fields directly');
select throws_ok($$ update public.proposals set version = 50 where id = 'a2000000-0000-4000-8000-0000000000b1' $$,
  '42501', null, 'the version number cannot be set directly');
select throws_ok($$ insert into public.proposals (organization_id, title, status, created_by)
  values ('a2000000-0000-4000-8000-00000000000a', 'forged', 'approved_internally', 'a2000000-0000-4000-8000-0000000000a2') $$,
  '42501', null, 'sales cannot create a proposal that is already approved');
select lives_ok($$ insert into public.proposals (id, organization_id, title, approved_at, version, created_by)
  values ('a2000000-0000-4000-8000-0000000000b2', 'a2000000-0000-4000-8000-00000000000a', 'P2 second', now(), 9, 'a2000000-0000-4000-8000-0000000000a2') $$,
  'sales creates a draft');
select ok((select approved_at is null and version = 1 from public.proposals where id = 'a2000000-0000-4000-8000-0000000000b2'),
  'approval fields and version supplied on insert are ignored');

select lives_ok($$ update public.proposals set status = 'under_review' where id = 'a2000000-0000-4000-8000-0000000000b1' $$, 'sales submits again');
select results_eq($$ with u as (update public.proposal_sections set body = 'during review' where proposal_id = 'a2000000-0000-4000-8000-0000000000b1' returning 1)
  select count(*)::int from u $$, $$ values (0) $$, 'content is locked during review');
select throws_ok($$ update public.proposals set title = 'renamed in review' where id = 'a2000000-0000-4000-8000-0000000000b1' $$,
  '42501', null, 'the header is locked during review');
select throws_ok($$ select public.convert_proposal_to_project('a2000000-0000-4000-8000-0000000000b1') $$,
  '42501', null, 'sales cannot convert an unapproved proposal');
select is((select count(*) from public.projects where name = 'P2 proposal'), 0::bigint, 'a refused conversion leaves no project behind');

set local "request.jwt.claims" to '{"sub":"a2000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select lives_ok($$ insert into public.proposal_reviews (proposal_id, organization_id, version, decision, comment)
  values ('a2000000-0000-4000-8000-0000000000b1', 'a2000000-0000-4000-8000-00000000000a', (select version - 1 from public.proposals where id = 'a2000000-0000-4000-8000-0000000000b1'), 'approved', 'OK') $$,
  'the admin approves the second submission');

set local "request.jwt.claims" to '{"sub":"a2000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select lives_ok($$ update public.proposals set status = 'under_review' where id = 'a2000000-0000-4000-8000-0000000000b1' $$, 'sales re-submits the approved proposal');
select ok((select approved_at is null from public.proposals where id = 'a2000000-0000-4000-8000-0000000000b1'), 're-submission clears the approval');
select throws_ok($$ update public.proposals set status = 'sent_to_client' where id = 'a2000000-0000-4000-8000-0000000000b1' $$,
  '42501', null, 'a re-submitted proposal cannot go to the client before a new approval');

set local "request.jwt.claims" to '{"sub":"a2000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select lives_ok($$ insert into public.proposal_reviews (proposal_id, organization_id, version, decision, comment)
  values ('a2000000-0000-4000-8000-0000000000b1', 'a2000000-0000-4000-8000-00000000000a', (select version - 1 from public.proposals where id = 'a2000000-0000-4000-8000-0000000000b1'), 'approved', 'Final') $$,
  'the admin approves the re-submission');

-- ---------------------------------------------------------------------------
-- Conversion to a project: one transaction, client prices only
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"a2000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select ok((select public.convert_proposal_to_project('a2000000-0000-4000-8000-0000000000b1') is not null), 'once approved, sales converts the proposal into a project');
select is((select status::text from public.proposals where id = 'a2000000-0000-4000-8000-0000000000b1'), 'converted', 'the proposal is marked converted');
select is((select count(*) from public.boq_items b join public.proposals p on p.project_id = b.project_id where p.id = 'a2000000-0000-4000-8000-0000000000b1'),
  1::bigint, 'the BOQ is copied');
select is((select b.unit_price from public.boq_items b join public.proposals p on p.project_id = b.project_id where p.id = 'a2000000-0000-4000-8000-0000000000b1'),
  900.00::numeric, 'the BOQ carries client prices, not internal costs');
select is((select pr.budget from public.projects pr join public.proposals p on p.project_id = pr.id where p.id = 'a2000000-0000-4000-8000-0000000000b1'),
  900.00::numeric, 'the project budget is the proposal subtotal');
select is((select public.convert_proposal_to_project('a2000000-0000-4000-8000-0000000000b1')), (select project_id from public.proposals where id = 'a2000000-0000-4000-8000-0000000000b1'),
  'converting again returns the same project');

set local "request.jwt.claims" to '{"sub":"a2000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
select throws_ok($$ select public.convert_proposal_to_project('a2000000-0000-4000-8000-0000000000b2') $$,
  '42501', null, 'a viewer cannot convert proposals');

-- ---------------------------------------------------------------------------
-- AI usage log integrity
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"a2000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select lives_ok($$ insert into public.ai_usage_logs (organization_id, feature, provider, request_hash)
  values ('a2000000-0000-4000-8000-00000000000a', 'proposal_draft', 'mock', repeat('a', 64)) $$, 'a user starts an AI request');
select throws_ok($$ insert into public.ai_usage_logs (organization_id, feature, provider, request_hash)
  values ('a2000000-0000-4000-8000-00000000000a', 'proposal_draft', 'mock', repeat('a', 64)) $$,
  '23505', null, 'an identical request cannot run twice at the same time');
select throws_ok($$ insert into public.ai_usage_logs (organization_id, user_id, feature, provider, request_hash)
  values ('a2000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-0000000000a1', 'proposal_draft', 'mock', repeat('b', 64)) $$,
  '42501', null, 'nobody can log usage on someone else''s behalf');
select throws_ok($$ update public.ai_usage_logs set created_at = now() - interval '2 days' $$,
  '42501', null, 'the request time cannot be rewritten to dodge rate limits');
select lives_ok($$ update public.ai_usage_logs set status = 'success', input_tokens = 100, output_tokens = 50, finished_at = now() $$,
  'a user finishes their own request');
select throws_ok($$ update public.ai_usage_logs set input_tokens = 0 $$, '42501', null, 'a finished record cannot change');
select throws_ok($$ insert into public.ai_usage_logs (organization_id, feature, provider, request_hash, input_tokens)
  values ('a2000000-0000-4000-8000-00000000000a', 'proposal_draft', 'mock', repeat('c', 64), 3000000) $$,
  '23514', null, 'implausible token counts are refused');

reset role;
select * from finish();
rollback;
