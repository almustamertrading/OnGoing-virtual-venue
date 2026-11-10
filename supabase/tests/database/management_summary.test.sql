-- Workflow F: the management summary facts (scoped by each caller's access; finance only with finance
-- access) and management briefs readable only by their author and organisation admins.
-- Acts as real users through request.jwt.claims; synthetic .test data; rolls back.

begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into public.organizations (id, name, email_domain) values
  ('c7000000-0000-4000-8000-00000000000a', 'Mgmt Org', 'mgmt-a.test'),
  ('d7000000-0000-4000-8000-00000000000b', 'Mgmt Other', 'mgmt-b.test');
insert into public.organization_domains (domain, organization_id) values
  ('mgmt-a.test', 'c7000000-0000-4000-8000-00000000000a'), ('mgmt-b.test', 'd7000000-0000-4000-8000-00000000000b');
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email, now(),
       '{"provider":"email","providers":["email"]}', '{}', now() + (u.n || ' seconds')::interval, now()
from (values
  (1, 'c7000000-0000-4000-8000-0000000000a1', 'admin@mgmt-a.test'),
  (2, 'c7000000-0000-4000-8000-0000000000a2', 'finance@mgmt-a.test'),
  (3, 'c7000000-0000-4000-8000-0000000000a3', 'sales@mgmt-a.test'),
  (4, 'c7000000-0000-4000-8000-0000000000a4', 'pm@mgmt-a.test'),
  (5, 'd7000000-0000-4000-8000-0000000000b1', 'admin@mgmt-b.test')
) as u(n, id, email) order by u.n;
update public.organization_members set capabilities = '{finance_access}' where user_id = 'c7000000-0000-4000-8000-0000000000a2';
update public.organization_members set capabilities = '{sales_access}' where user_id = 'c7000000-0000-4000-8000-0000000000a3';
update public.organization_members set capabilities = '{project_manager}' where user_id = 'c7000000-0000-4000-8000-0000000000a4';

-- One project the finance and sales users belong to (not the project manager), starting in ten days.
insert into public.projects (id, organization_id, name, budget, start_date, created_by) values
  ('c7000000-0000-4000-8000-0000000000e1', 'c7000000-0000-4000-8000-00000000000a', 'Mgmt project', 1000,
   (now() at time zone 'Asia/Riyadh')::date + 10, 'c7000000-0000-4000-8000-0000000000a1');
insert into public.project_members (project_id, user_id, role) values
  ('c7000000-0000-4000-8000-0000000000e1', 'c7000000-0000-4000-8000-0000000000a2', 'viewer'),
  ('c7000000-0000-4000-8000-0000000000e1', 'c7000000-0000-4000-8000-0000000000a3', 'editor');

insert into public.tasks (project_id, title, status, due_date, created_by) values
  ('c7000000-0000-4000-8000-0000000000e1', 'Overdue task', 'todo', (now() at time zone 'Asia/Riyadh')::date - 3, 'c7000000-0000-4000-8000-0000000000a1'),
  ('c7000000-0000-4000-8000-0000000000e1', 'Blocked task', 'blocked', null, 'c7000000-0000-4000-8000-0000000000a1'),
  ('c7000000-0000-4000-8000-0000000000e1', 'Due this week', 'todo', (now() at time zone 'Asia/Riyadh')::date + 2, 'c7000000-0000-4000-8000-0000000000a1'),
  ('c7000000-0000-4000-8000-0000000000e1', 'Finished task', 'done', null, 'c7000000-0000-4000-8000-0000000000a1');
insert into public.milestones (project_id, title, due_date, done, created_by) values
  ('c7000000-0000-4000-8000-0000000000e1', 'Late milestone', (now() at time zone 'Asia/Riyadh')::date - 1, false, 'c7000000-0000-4000-8000-0000000000a1'),
  ('c7000000-0000-4000-8000-0000000000e1', 'Next milestone', (now() at time zone 'Asia/Riyadh')::date + 5, false, 'c7000000-0000-4000-8000-0000000000a1');
insert into public.proposals (id, organization_id, title, status, created_by) values
  ('c7000000-0000-4000-8000-000000000071', 'c7000000-0000-4000-8000-00000000000a', 'Proposal in review', 'under_review', 'c7000000-0000-4000-8000-0000000000a1'),
  ('c7000000-0000-4000-8000-000000000072', 'c7000000-0000-4000-8000-00000000000a', 'Thin-margin proposal', 'approved_internally', 'c7000000-0000-4000-8000-0000000000a1');
insert into public.proposal_items (id, proposal_id, organization_id, description, quantity, unit_price, created_by) values
  ('c7000000-0000-4000-8000-0000000000c1', 'c7000000-0000-4000-8000-000000000072', 'c7000000-0000-4000-8000-00000000000a', 'Stage', 1, 100, 'c7000000-0000-4000-8000-0000000000a1');
insert into public.proposal_item_costs (item_id, organization_id, unit_cost) values
  ('c7000000-0000-4000-8000-0000000000c1', 'c7000000-0000-4000-8000-00000000000a', 95);
insert into public.ai_findings (organization_id, project_id, workflow, kind, title, created_by) values
  ('c7000000-0000-4000-8000-00000000000a', 'c7000000-0000-4000-8000-0000000000e1', 'tender', 'requirement', 'Project finding', 'c7000000-0000-4000-8000-0000000000a1'),
  ('c7000000-0000-4000-8000-00000000000a', null, 'tender', 'requirement', 'Organisation finding', 'c7000000-0000-4000-8000-0000000000a1');
insert into public.project_requirements (project_id, organization_id, title, due_date, created_by) values
  ('c7000000-0000-4000-8000-0000000000e1', 'c7000000-0000-4000-8000-00000000000a', 'Bank guarantee', (now() at time zone 'Asia/Riyadh')::date + 3, 'c7000000-0000-4000-8000-0000000000a1');
insert into public.rfqs (id, project_id, title, status, due_date, created_by) values
  ('c7000000-0000-4000-8000-000000000081', 'c7000000-0000-4000-8000-0000000000e1', 'Lighting', 'sent', (now() at time zone 'Asia/Riyadh')::date - 1, 'c7000000-0000-4000-8000-0000000000a1');
insert into public.quotes (rfq_id, project_id, supplier_name, amount, created_by) values
  ('c7000000-0000-4000-8000-000000000081', 'c7000000-0000-4000-8000-0000000000e1', 'Lights Co', 400, 'c7000000-0000-4000-8000-0000000000a1');
insert into public.invoices (project_id, number, amount, status, due_date, created_by) values
  ('c7000000-0000-4000-8000-0000000000e1', 'INV-1', 500, 'sent', (now() at time zone 'Asia/Riyadh')::date - 5, 'c7000000-0000-4000-8000-0000000000a1');
insert into public.expenses (project_id, label, amount, created_by) values
  ('c7000000-0000-4000-8000-0000000000e1', 'Venue', 1500, 'c7000000-0000-4000-8000-0000000000a1');
insert into public.project_risks (project_id, organization_id, kind, title, impact, created_by) values
  ('c7000000-0000-4000-8000-0000000000e1', 'c7000000-0000-4000-8000-00000000000a', 'issue', 'Power supply', 'high', 'c7000000-0000-4000-8000-0000000000a1');

set constraints all immediate;
set local role authenticated;

-- ----- The organisation admin: every project, with finance -----
set local "request.jwt.claims" to '{"sub":"c7000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
create temp table s_admin on commit drop as select public.management_summary('c7000000-0000-4000-8000-00000000000a') as s;
select ok((select (s ->> 'finance_access')::boolean and s -> 'finance' is not null from s_admin), 'an admin gets the finance facts');
select is((select (s #>> '{tasks,overdue_total}')::int from s_admin), 1, 'overdue tasks are counted');
select is((select (s #>> '{tasks,blocked_total}')::int from s_admin), 1, 'blocked tasks are counted');
select is((select (s #>> '{tasks,due_week_total}')::int from s_admin), 1, 'tasks due in the next seven days are counted');
select is((select (s #>> '{tasks,done_week_total}')::int from s_admin), 1, 'tasks completed in the last seven days are counted');
select is((select s #>> '{tasks,overdue_by_project,0,name}' from s_admin), 'Mgmt project', 'overdue tasks are listed per project');
select ok((select (s #>> '{milestones,overdue_total}')::int = 1 and (s #>> '{milestones,upcoming_total}')::int = 1 from s_admin),
  'overdue and upcoming milestones are counted');
select ok((select (s #>> '{approvals,under_review_total}')::int = 1 and (s #>> '{approvals,approved_not_sent_total}')::int = 1 from s_admin),
  'proposals waiting for internal approval or for sending are counted');
select ok((select s -> 'approvals' -> 'findings_proposed' @> '[{"workflow":"tender","count":2}]' from s_admin),
  'AI findings awaiting review are counted per workflow');
select is((select (s #>> '{approvals,requirements_due_total}')::int from s_admin), 1, 'mandatory requirements due within two weeks are counted');
select ok((select (s #>> '{procurement,response_overdue_total}')::int = 1 and (s #>> '{procurement,near_event_total}')::int = 1
             and (s #>> '{procurement,open,0,priced_quotes}')::int = 1 from s_admin),
  'an open RFQ past its response date and close to the event is flagged, with its priced quotes for finance');
select ok((select (s #>> '{risks,open_issues}')::int = 1 and (s #>> '{risks,high_total}')::int = 1 from s_admin), 'open high-impact issues are counted');
select is((select (s #>> '{pipeline,open_value}')::numeric from s_admin), 100.00, 'the open pipeline value is the selling price of non-optional lines');
select ok((select (s #>> '{finance,overdue_invoices_total}')::int = 1 and (s #>> '{finance,overdue_amount}')::numeric = 500
             and (s #>> '{finance,outstanding_total}')::numeric = 500 from s_admin), 'overdue and outstanding invoices are totalled');
select is((select (s #>> '{finance,over_budget,0,excess}')::numeric from s_admin), 500.00, 'a project over budget is flagged with the excess');
select is((select (s #>> '{finance,negative_margin,0,margin}')::numeric from s_admin), -1000.00, 'expenses above invoicing are flagged');
select is((select (s #>> '{finance,low_margin_proposals,0,margin_pct}')::numeric from s_admin), 5.0, 'an open proposal with a thin margin is estimated');

-- ----- A sales editor on the project: project facts, no finance -----
set local "request.jwt.claims" to '{"sub":"c7000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
create temp table s_sales on commit drop as select public.management_summary('c7000000-0000-4000-8000-00000000000a') as s;
select ok((select not (s ->> 'finance_access')::boolean and jsonb_typeof(s -> 'finance') = 'null' from s_sales),
  'without finance access the finance facts are null, not zero');
select is((select (s #>> '{tasks,overdue_total}')::int from s_sales), 1, 'a project member sees the project''s overdue tasks');
select ok((select jsonb_typeof(s #> '{procurement,open,0,priced_quotes}') = 'null' from s_sales), 'supplier quote counts are hidden without finance access');

-- ----- A finance member of the project -----
set local "request.jwt.claims" to '{"sub":"c7000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select ok((select (s #>> '{finance,overdue_invoices_total}')::int = 1 and (s #>> '{procurement,open,0,priced_quotes}')::int = 1
           from (select public.management_summary('c7000000-0000-4000-8000-00000000000a') as s) x),
  'a finance member gets the finance facts of their projects');

-- ----- A project manager outside the project: their own view only -----
set local "request.jwt.claims" to '{"sub":"c7000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
select is((select (public.management_summary('c7000000-0000-4000-8000-00000000000a') #>> '{tasks,overdue_total}')::int), 0,
  'facts follow the caller''s access: no tasks from projects they are not on');
select lives_ok($$ insert into public.ai_findings (id, organization_id, workflow, kind, title, created_by) values
  ('c7000000-0000-4000-8000-0000000000f1', 'c7000000-0000-4000-8000-00000000000a', 'management', 'recommendation', 'Chase the late RFQs',
   'c7000000-0000-4000-8000-0000000000a4') $$, 'a project manager saves a management brief');
select throws_ok($$ insert into public.ai_findings (organization_id, workflow, kind, title, finance_only, created_by) values
  ('c7000000-0000-4000-8000-00000000000a', 'management', 'recommendation', 'Margin brief', true, 'c7000000-0000-4000-8000-0000000000a4') $$,
  '42501', null, 'a brief built on finance facts needs finance access to be saved');

-- ----- Who can read a brief -----
set local "request.jwt.claims" to '{"sub":"c7000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
select throws_ok($$ insert into public.ai_findings (organization_id, workflow, kind, title, created_by) values
  ('c7000000-0000-4000-8000-00000000000a', 'management', 'recommendation', 'Sales brief', 'c7000000-0000-4000-8000-0000000000a3') $$,
  '42501', null, 'members without a management role cannot save briefs');
select is((select count(*)::int from public.ai_findings where id = 'c7000000-0000-4000-8000-0000000000f1'), 0,
  'another member cannot read someone else''s brief');
select is((select count(*)::int from public.ai_findings where title = 'Organisation finding'), 1,
  'organisation-level findings of other workflows stay readable to members');
set local "request.jwt.claims" to '{"sub":"c7000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select is((select count(*)::int from public.ai_findings where id = 'c7000000-0000-4000-8000-0000000000f1'), 0,
  'finance access alone does not open someone else''s brief');
set local "request.jwt.claims" to '{"sub":"c7000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select count(*)::int from public.ai_findings where id = 'c7000000-0000-4000-8000-0000000000f1'), 1,
  'an organisation admin can read every brief');

set local "request.jwt.claims" to '{"sub":"c7000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
update public.ai_findings set status = 'rejected', review_note = 'Already chased' where id = 'c7000000-0000-4000-8000-0000000000f1';
select ok((select status = 'rejected' and reviewed_by = 'c7000000-0000-4000-8000-0000000000a4' from public.ai_findings
           where id = 'c7000000-0000-4000-8000-0000000000f1'), 'the author reviews their own brief');

-- ----- Another organisation -----
set local "request.jwt.claims" to '{"sub":"d7000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select throws_ok($$ select public.management_summary('c7000000-0000-4000-8000-00000000000a') $$, '42501', null,
  'a member of another organisation gets no summary');

select * from finish();
rollback;
