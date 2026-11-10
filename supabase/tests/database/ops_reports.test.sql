-- Workflow E: operations reports, the issues and risks log, and accepting AI findings as tasks or risks.
-- Acts as real users through request.jwt.claims; synthetic .test data; rolls back.

begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into public.organizations (id, name, email_domain) values
  ('a6000000-0000-4000-8000-00000000000a', 'Ops Org', 'ops-a.test'),
  ('b6000000-0000-4000-8000-00000000000b', 'Ops Other', 'ops-b.test');
insert into public.organization_domains (domain, organization_id) values
  ('ops-a.test', 'a6000000-0000-4000-8000-00000000000a'), ('ops-b.test', 'b6000000-0000-4000-8000-00000000000b');
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email, now(),
       '{"provider":"email","providers":["email"]}', '{}', now() + (u.n || ' seconds')::interval, now()
from (values
  (1, 'a6000000-0000-4000-8000-0000000000a1', 'admin@ops-a.test'),
  (2, 'a6000000-0000-4000-8000-0000000000a2', 'lead@ops-a.test'),
  (3, 'a6000000-0000-4000-8000-0000000000a3', 'crew@ops-a.test'),
  (4, 'b6000000-0000-4000-8000-0000000000b1', 'admin@ops-b.test')
) as u(n, id, email) order by u.n;
update public.organization_members set capabilities = '{operations_access}' where user_id = 'a6000000-0000-4000-8000-0000000000a2';
insert into public.projects (id, organization_id, name, created_by) values
  ('a6000000-0000-4000-8000-0000000000e1', 'a6000000-0000-4000-8000-00000000000a', 'Ops project', 'a6000000-0000-4000-8000-0000000000a1');
insert into public.project_members (project_id, user_id, role) values
  ('a6000000-0000-4000-8000-0000000000e1', 'a6000000-0000-4000-8000-0000000000a2', 'editor'),
  ('a6000000-0000-4000-8000-0000000000e1', 'a6000000-0000-4000-8000-0000000000a3', 'viewer');

set constraints all immediate;
set local role authenticated;

set local "request.jwt.claims" to '{"sub":"a6000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select lives_ok($$ insert into public.ops_reports (id, project_id, organization_id, kind, title, report_date, body)
  values ('a6000000-0000-4000-8000-0000000000d1', 'a6000000-0000-4000-8000-0000000000e1', 'a6000000-0000-4000-8000-00000000000a',
    'venue_inspection', 'Hall A inspection', '2026-11-12', 'Fire exits blocked by staging cases.') $$,
  'a project editor records a venue inspection');
select lives_ok($$ insert into public.ai_usage_logs (organization_id, feature, provider, request_hash)
  values ('a6000000-0000-4000-8000-00000000000a', 'ops_extract', 'mock', repeat('e', 64)) $$, 'operations extraction is a logged AI feature');
select lives_ok($$ insert into public.ai_findings (id, organization_id, project_id, workflow, kind, title, detail, source_excerpt, source_verified, data) values
  ('a6000000-0000-4000-8000-0000000000f1', 'a6000000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-0000000000e1', 'operations', 'action_item',
   'Clear the fire exits', 'Move staging cases', 'Fire exits blocked by staging cases', true,
   '{"suggested_assignee_id":"a6000000-0000-4000-8000-0000000000a3","due_date":"2026-11-13","priority":"high","report_id":"a6000000-0000-4000-8000-0000000000d1"}'),
  ('a6000000-0000-4000-8000-0000000000f2', 'a6000000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-0000000000e1', 'operations', 'risk',
   'Evacuation risk', 'Blocked exits', 'Fire exits blocked', true,
   '{"impact":"high","likelihood":"medium","mitigation":"Daily exit check","report_id":"a6000000-0000-4000-8000-0000000000d1"}'),
  ('a6000000-0000-4000-8000-0000000000f3', 'a6000000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-0000000000e1', 'operations', 'issue',
   'Generator noise', '', '', false, '{"impact":"low"}'),
  ('a6000000-0000-4000-8000-0000000000f4', 'a6000000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-0000000000e1', 'operations', 'action_item',
   'Call the outsider', '', '', false, '{"suggested_assignee_id":"b6000000-0000-4000-8000-0000000000b1"}') $$,
  'the editor records extracted operations findings');

select ok((select public.accept_finding_as_task('a6000000-0000-4000-8000-0000000000f1', 'Urgent') is not null), 'an action item becomes a task');
select ok((select t.assignee_id = 'a6000000-0000-4000-8000-0000000000a3' and t.due_date = '2026-11-13' and t.priority = 'high' and t.status = 'todo'
           from public.tasks t where t.title = 'Clear the fire exits'),
  'the task takes the suggested assignee, due date and priority');
select ok((select status = 'accepted' and target_table = 'tasks' and reviewed_by = 'a6000000-0000-4000-8000-0000000000a2'
           from public.ai_findings where id = 'a6000000-0000-4000-8000-0000000000f1'), 'the finding records what it became and who decided');
select throws_ok($$ select public.accept_finding_as_task('a6000000-0000-4000-8000-0000000000f1') $$, '22023', null, 'a finding is decided once');
select throws_ok($$ select public.accept_finding_as_task('a6000000-0000-4000-8000-0000000000f2') $$, '22023', null, 'a risk does not become a task');
select lives_ok($$ select public.accept_finding_as_task('a6000000-0000-4000-8000-0000000000f4') $$, 'an action item with an outside assignee is accepted');
select ok((select assignee_id is null from public.tasks where title = 'Call the outsider'),
  'a suggested assignee from outside the project is not used');

select ok((select public.accept_finding_as_risk('a6000000-0000-4000-8000-0000000000f2') is not null), 'a risk joins the risk log');
select ok((select r.kind = 'risk' and r.impact = 'high' and r.likelihood = 'medium' and r.mitigation = 'Daily exit check'
             and r.source_report_id = 'a6000000-0000-4000-8000-0000000000d1' and r.status = 'open'
           from public.project_risks r where r.title = 'Evacuation risk'),
  'the risk keeps impact, likelihood, mitigation and its source report');
select lives_ok($$ select public.accept_finding_as_risk('a6000000-0000-4000-8000-0000000000f3') $$, 'an issue is accepted');
select ok((select kind = 'issue' and likelihood is null and impact = 'low' from public.project_risks where title = 'Generator noise'),
  'an issue joins the log without a likelihood');
select throws_ok($$ update public.project_risks set owner_id = 'b6000000-0000-4000-8000-0000000000b1' where title = 'Evacuation risk' $$,
  '23514', null, 'a risk owner must belong to the project or organisation');
select lives_ok($$ update public.project_risks set owner_id = 'a6000000-0000-4000-8000-0000000000a3', status = 'mitigating' where title = 'Evacuation risk' $$,
  'the editor assigns an owner and starts mitigation');
select ok((select count(*) from public.activity where entity_type in ('ops_reports', 'project_risks')) >= 2, 'reports and the log appear in the activity feed');

set local "request.jwt.claims" to '{"sub":"a6000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
select ok((select count(*) from public.ops_reports) = 1 and (select count(*) from public.project_risks) = 2, 'a project viewer reads reports and the log');
select throws_ok($$ insert into public.ops_reports (project_id, organization_id, title)
  values ('a6000000-0000-4000-8000-0000000000e1', 'a6000000-0000-4000-8000-00000000000a', 'x') $$, '42501', null, 'a viewer cannot write reports');
select results_eq($$ with u as (update public.project_risks set status = 'closed' returning 1) select count(*)::int from u $$,
  $$ values (0) $$, 'a viewer cannot change the log');

set local "request.jwt.claims" to '{"sub":"b6000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select ok((select count(*) from public.ops_reports) = 0 and (select count(*) from public.project_risks) = 0, 'another organisation sees nothing');
select throws_ok($$ select public.accept_finding_as_risk('a6000000-0000-4000-8000-0000000000f3') $$, '42501', null, 'and cannot accept findings');

reset role;
select * from finish();
rollback;
