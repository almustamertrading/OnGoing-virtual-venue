-- Management intelligence (Workflow F, increment 1).
--  1. management_summary(org): the facts behind the management summary, computed from live data as the
--     caller (security invoker), so every figure is one the caller may already see. Finance facts are
--     returned only to callers holding finance access; everyone else gets null, never a misleading zero.
--  2. AI management briefs are findings (workflow 'management') built from one person's view of the data.
--     That view may include projects and finance figures other members cannot see, so a brief is readable
--     only by its author and organisation admins (whose view includes every project), and only managers
--     may create one.

-- ---------------------------------------------------------------------------
-- 1. AI feature
-- ---------------------------------------------------------------------------
alter table public.ai_usage_logs drop constraint ai_usage_logs_feature_check;
alter table public.ai_usage_logs add constraint ai_usage_logs_feature_check
  check (feature in ('rfp_extract', 'proposal_draft', 'tender_analysis', 'ops_extract', 'management_brief'));

-- ---------------------------------------------------------------------------
-- 2. Management briefs: author and admins only
-- ---------------------------------------------------------------------------
-- Organisation managers and members with the project_manager capability (admins hold every capability).
create or replace function private.can_request_management_brief(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_org_manager(oid) or private.has_capability(oid, 'project_manager');
$$;
revoke execute on function private.can_request_management_brief(uuid) from public, anon;
grant execute on function private.can_request_management_brief(uuid) to authenticated;

drop policy "ai findings: read" on public.ai_findings;
create policy "ai findings: read" on public.ai_findings
  for select to authenticated
  using (
    (select private.is_org_member(organization_id))
    and (project_id is null or (select private.is_member(project_id)))
    and (
      not finance_only
      or (project_id is not null and (select private.can_access_project_finance(project_id)))
      or (project_id is null and (select private.has_capability(organization_id, 'finance_access')))
    )
    and (
      workflow <> 'management'
      or created_by = (select auth.uid())
      or (select private.is_org_admin(organization_id))
    )
  );

drop policy "ai findings: add" on public.ai_findings;
create policy "ai findings: add" on public.ai_findings
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and status = 'proposed'
    and (
      (project_id is null and (select private.can_contribute(organization_id)))
      or (project_id is not null and (select private.can_edit(project_id)))
    )
    and (
      not finance_only
      or (project_id is not null and (select private.can_access_project_finance(project_id)))
      or (project_id is null and (select private.has_capability(organization_id, 'finance_access')))
    )
    and (workflow <> 'management' or (project_id is null and (select private.can_request_management_brief(organization_id))))
  );

drop policy "ai findings: review" on public.ai_findings;
create policy "ai findings: review" on public.ai_findings
  for update to authenticated
  using (
    (
      (project_id is null and (select private.can_contribute(organization_id)))
      or (project_id is not null and (select private.can_edit(project_id)))
    )
    and (workflow <> 'management' or created_by = (select auth.uid()) or (select private.is_org_admin(organization_id)))
  )
  with check (
    (
      (project_id is null and (select private.can_contribute(organization_id)))
      or (project_id is not null and (select private.can_edit(project_id)))
    )
    and (workflow <> 'management' or created_by = (select auth.uid()) or (select private.is_org_admin(organization_id)))
  );

-- ---------------------------------------------------------------------------
-- 3. The facts behind the management summary
-- ---------------------------------------------------------------------------
-- Lists hold at most 10 entries; each comes with its full count. "Today" is the organisation's local date.
create or replace function public.management_summary(org uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  tz text := coalesce((select o.timezone from public.organizations o where o.id = org), 'Asia/Riyadh');
  today date := (now() at time zone tz)::date;
  finance boolean := (select private.has_capability(org, 'finance_access'));
  v_projects jsonb;
  v_tasks jsonb;
  v_milestones jsonb;
  v_approvals jsonb;
  v_procurement jsonb;
  v_risks jsonb;
  v_pipeline jsonb;
  v_finance jsonb;
begin
  if not (select private.is_org_member(org)) then
    raise exception 'Not a member of this organisation' using errcode = '42501';
  end if;

  select jsonb_build_object(
           'total', count(*),
           'active', count(*) filter (where p.status in ('lead', 'proposal', 'confirmed', 'in_progress', 'on_hold')),
           'in_delivery', count(*) filter (where p.status in ('confirmed', 'in_progress')))
  into v_projects
  from public.projects p
  where p.organization_id = org;

  with per_project as (
    select p.id as project_id, p.code, p.name,
           count(*) filter (where x.status <> 'done' and x.due_date < today) as overdue,
           min(x.due_date) filter (where x.status <> 'done' and x.due_date < today) as oldest_due,
           count(*) filter (where x.status = 'blocked') as blocked,
           count(*) filter (where x.status <> 'done' and x.due_date between today and today + 6) as due_week,
           count(*) filter (where x.status = 'done' and x.completed_at >= now() - interval '7 days') as done_week
    from public.projects p
    join public.tasks x on x.project_id = p.id
    where p.organization_id = org
    group by p.id, p.code, p.name
  )
  select jsonb_build_object(
           'overdue_total', coalesce(sum(overdue), 0),
           'blocked_total', coalesce(sum(blocked), 0),
           'due_week_total', coalesce(sum(due_week), 0),
           'done_week_total', coalesce(sum(done_week), 0),
           'overdue_by_project', coalesce((
             select jsonb_agg(jsonb_build_object('project_id', t.project_id, 'code', t.code, 'name', t.name,
                                                 'count', t.overdue, 'oldest_due', t.oldest_due)
                              order by t.overdue desc, t.oldest_due, t.code)
             from (select * from per_project where overdue > 0 order by overdue desc, oldest_due, code limit 10) t
           ), '[]'::jsonb),
           'blocked_by_project', coalesce((
             select jsonb_agg(jsonb_build_object('project_id', t.project_id, 'code', t.code, 'name', t.name, 'count', t.blocked)
                              order by t.blocked desc, t.code)
             from (select * from per_project where blocked > 0 order by blocked desc, code limit 10) t
           ), '[]'::jsonb))
  into v_tasks
  from per_project;

  select jsonb_build_object(
           'overdue_total', (select count(*) from public.milestones y join public.projects p on p.id = y.project_id
                             where p.organization_id = org and not y.done and y.due_date < today),
           'upcoming_total', (select count(*) from public.milestones y join public.projects p on p.id = y.project_id
                              where p.organization_id = org and not y.done and y.due_date between today and today + 13),
           'overdue', coalesce((
             select jsonb_agg(m order by m.due_date, m.code) from (
               select p.id as project_id, p.code, p.name, y.title, y.due_date
               from public.milestones y join public.projects p on p.id = y.project_id
               where p.organization_id = org and not y.done and y.due_date < today
               order by y.due_date, p.code limit 10) m
           ), '[]'::jsonb),
           'upcoming', coalesce((
             select jsonb_agg(m order by m.due_date, m.code) from (
               select p.id as project_id, p.code, p.name, y.title, y.due_date
               from public.milestones y join public.projects p on p.id = y.project_id
               where p.organization_id = org and not y.done and y.due_date between today and today + 13
               order by y.due_date, p.code limit 10) m
           ), '[]'::jsonb))
  into v_milestones;

  select jsonb_build_object(
           'under_review_total', (select count(*) from public.proposals pr where pr.organization_id = org and pr.status = 'under_review'),
           'under_review', coalesce((
             select jsonb_agg(x order by x.since) from (
               select pr.id, pr.reference, pr.title, pr.updated_at as since
               from public.proposals pr where pr.organization_id = org and pr.status = 'under_review'
               order by pr.updated_at limit 10) x
           ), '[]'::jsonb),
           'approved_not_sent_total', (select count(*) from public.proposals pr where pr.organization_id = org and pr.status = 'approved_internally'),
           'approved_not_sent', coalesce((
             select jsonb_agg(x order by x.since) from (
               select pr.id, pr.reference, pr.title, pr.updated_at as since
               from public.proposals pr where pr.organization_id = org and pr.status = 'approved_internally'
               order by pr.updated_at limit 10) x
           ), '[]'::jsonb),
           'findings_proposed', coalesce((
             select jsonb_agg(jsonb_build_object('workflow', f.workflow, 'count', f.n) order by f.workflow) from (
               select a.workflow, count(*) as n from public.ai_findings a
               where a.organization_id = org and a.status = 'proposed' group by a.workflow) f
           ), '[]'::jsonb),
           'requirements_due_total', (
             select count(*) from public.project_requirements r join public.projects p on p.id = r.project_id
             where p.organization_id = org and r.mandatory and r.status in ('open', 'in_progress')
               and r.due_date is not null and r.due_date <= today + 13),
           'requirements_due', coalesce((
             select jsonb_agg(x order by x.due_date, x.code) from (
               select p.id as project_id, p.code, p.name, r.title, r.due_date, (r.due_date < today) as overdue
               from public.project_requirements r join public.projects p on p.id = r.project_id
               where p.organization_id = org and r.mandatory and r.status in ('open', 'in_progress')
                 and r.due_date is not null and r.due_date <= today + 13
               order by r.due_date, p.code limit 10) x
           ), '[]'::jsonb))
  into v_approvals;

  -- Open RFQs (draft or sent). Quote counts are supplier data: only with finance access to the project.
  with open_rfqs as (
    select r.id as rfq_id, p.id as project_id, p.code, p.name, r.title, r.status, r.due_date,
           today - (r.created_at at time zone tz)::date as days_open,
           p.start_date as event_start,
           (r.due_date is not null and r.due_date < today) as response_overdue,
           (p.start_date is not null and p.start_date between today and today + 20) as near_event,
           case when (select private.can_access_project_finance(p.id))
                then (select count(*) from public.quotes q where q.rfq_id = r.id and q.amount is not null) end as priced_quotes
    from public.rfqs r join public.projects p on p.id = r.project_id
    where p.organization_id = org and r.status in ('draft', 'sent')
  )
  select jsonb_build_object(
           'open_total', count(*),
           'response_overdue_total', count(*) filter (where response_overdue),
           'near_event_total', count(*) filter (where near_event),
           'open', coalesce((
             select jsonb_agg(x order by x.urgency, x.due_date nulls last, x.code) from (
               select o.*, case when o.response_overdue or o.near_event then 0 else 1 end as urgency
               from open_rfqs o
               order by case when o.response_overdue or o.near_event then 0 else 1 end, o.due_date nulls last, o.code limit 10) x
           ), '[]'::jsonb))
  into v_procurement
  from open_rfqs;

  select jsonb_build_object(
           'open_issues', count(*) filter (where k.kind = 'issue'),
           'open_risks', count(*) filter (where k.kind = 'risk'),
           'high_total', count(*) filter (where k.impact = 'high'),
           'high', coalesce((
             select jsonb_agg(x order by x.created_at desc) from (
               select k2.id, p.id as project_id, p.code, p.name, k2.kind, k2.title, k2.status, k2.owner_id, k2.created_at
               from public.project_risks k2 join public.projects p on p.id = k2.project_id
               where p.organization_id = org and k2.status <> 'closed' and k2.impact = 'high'
               order by k2.created_at desc limit 10) x
           ), '[]'::jsonb))
  into v_risks
  from public.project_risks k join public.projects p on p.id = k.project_id
  where p.organization_id = org and k.status <> 'closed';

  -- Selling prices of non-optional lines (as in the proposals report); no internal costs here.
  with per_status as (
    select pr.status, count(distinct pr.id) as n,
           coalesce(sum(case when not i.is_optional then i.quantity * i.unit_price end), 0) as value
    from public.proposals pr
    left join public.proposal_items i on i.proposal_id = pr.id
    where pr.organization_id = org
    group by pr.status
  )
  select jsonb_build_object(
           'open_total', coalesce(sum(n) filter (where status in ('draft', 'ai_generated', 'under_review', 'changes_requested', 'approved_internally', 'sent_to_client', 'awaiting_response')), 0),
           'open_value', coalesce(sum(value) filter (where status in ('draft', 'ai_generated', 'under_review', 'changes_requested', 'approved_internally', 'sent_to_client', 'awaiting_response')), 0),
           'awaiting_client_total', coalesce(sum(n) filter (where status in ('sent_to_client', 'awaiting_response')), 0),
           'awaiting_client_value', coalesce(sum(value) filter (where status in ('sent_to_client', 'awaiting_response')), 0),
           'by_status', coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', n, 'value', value) order by status), '[]'::jsonb))
  into v_pipeline
  from per_status;

  if finance then
    select jsonb_build_object(
             'outstanding_total', coalesce((
               select sum(i.amount) from public.invoices i join public.projects p on p.id = i.project_id
               where p.organization_id = org and i.status = 'sent'), 0),
             'overdue_invoices_total', (
               select count(*) from public.invoices i join public.projects p on p.id = i.project_id
               where p.organization_id = org and i.status = 'sent' and i.due_date < today),
             'overdue_amount', coalesce((
               select sum(i.amount) from public.invoices i join public.projects p on p.id = i.project_id
               where p.organization_id = org and i.status = 'sent' and i.due_date < today), 0),
             'overdue_invoices', coalesce((
               select jsonb_agg(x order by x.due_date, x.code) from (
                 select p.id as project_id, p.code, p.name, i.number, i.amount, i.due_date, today - i.due_date as days_overdue
                 from public.invoices i join public.projects p on p.id = i.project_id
                 where p.organization_id = org and i.status = 'sent' and i.due_date < today
                 order by i.due_date, p.code limit 10) x
             ), '[]'::jsonb),
             'over_budget', coalesce((
               select jsonb_agg(x order by x.excess desc, x.code) from (
                 select p.id as project_id, p.code, p.name, p.budget, e.total as expenses, e.total - p.budget as excess
                 from public.projects p
                 join lateral (select sum(ex.amount) as total from public.expenses ex where ex.project_id = p.id) e on true
                 where p.organization_id = org and p.budget > 0 and e.total > p.budget
                 order by e.total - p.budget desc, p.code limit 10) x
             ), '[]'::jsonb),
             'negative_margin', coalesce((
               select jsonb_agg(x order by x.margin, x.code) from (
                 select p.id as project_id, p.code, p.name, coalesce(iv.total, 0) as invoiced, e.total as expenses,
                        coalesce(iv.total, 0) - e.total as margin
                 from public.projects p
                 join lateral (select sum(ex.amount) as total from public.expenses ex where ex.project_id = p.id) e on true
                 left join lateral (select sum(i.amount) as total from public.invoices i where i.project_id = p.id) iv on true
                 where p.organization_id = org and e.total > 0 and coalesce(iv.total, 0) - e.total < 0
                 order by coalesce(iv.total, 0) - e.total, p.code limit 10) x
             ), '[]'::jsonb),
             -- An estimate: the margin an open proposal would make if won at today's prices and costs.
             -- Only proposals whose every non-optional line has a cost (a zero cost counts as missing).
             'low_margin_proposals', coalesce((
               select jsonb_agg(x order by x.margin_pct, x.reference) from (
                 select pr.id, pr.reference, pr.title, s.value,
                        round((s.value - s.cost) / nullif(s.value, 0) * 100, 1) as margin_pct
                 from public.proposals pr
                 join lateral (
                   select sum(i.quantity * i.unit_price) as value,
                          sum(i.quantity * c.unit_cost) as cost,
                          count(*) filter (where c.item_id is null or c.unit_cost = 0) as missing_cost
                   from public.proposal_items i
                   left join public.proposal_item_costs c on c.item_id = i.id
                   where i.proposal_id = pr.id and not i.is_optional
                 ) s on true
                 where pr.organization_id = org
                   and pr.status in ('under_review', 'approved_internally', 'sent_to_client', 'awaiting_response')
                   and s.value > 0 and s.missing_cost = 0 and (s.value - s.cost) / nullif(s.value, 0) < 0.10
                 order by round((s.value - s.cost) / nullif(s.value, 0) * 100, 1), pr.reference limit 10) x
             ), '[]'::jsonb))
    into v_finance;
  end if;

  return jsonb_build_object(
    'today', today,
    'generated_at', now(),
    'finance_access', finance,
    'projects', v_projects,
    'tasks', v_tasks,
    'milestones', v_milestones,
    'approvals', v_approvals,
    'procurement', v_procurement,
    'risks', v_risks,
    'pipeline', v_pipeline,
    'finance', v_finance
  );
end;
$$;
revoke execute on function public.management_summary(uuid) from public, anon;
grant execute on function public.management_summary(uuid) to authenticated;
