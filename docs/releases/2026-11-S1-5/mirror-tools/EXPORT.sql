-- Read-only structural export used to build the mirror (run against production by the release owner).
-- Returns IDs, relationships, roles, statuses and amounts only: no names, emails, free text or files.
select json_build_object(
 'org', (select json_agg(json_build_array(id)) from public.organizations),
 'users', (select json_agg(json_build_array(u.id, m.organization_id, m.role)) from auth.users u left join public.organization_members m on m.user_id = u.id),
 'clients', (select json_agg(json_build_array(id, created_by)) from public.clients),
 'projects', (select json_agg(json_build_array(id, client_id, code, status, project_type, budget, start_date, end_date, created_by)) from public.projects),
 'members', (select json_agg(json_build_array(project_id, user_id, role)) from public.project_members),
 'venues', (select json_agg(json_build_array(id, project_id, created_by)) from public.venues),
 'layouts', (select json_agg(json_build_array(id, project_id, venue_id, created_by)) from public.layouts),
 'layout_items', (select json_agg(json_build_array(layout_id, project_id, n, created_by)) from (select layout_id, project_id, count(*) n, min(created_by::text) created_by from public.layout_items group by 1, 2) x),
 'rfqs', (select json_agg(json_build_array(id, project_id, status, created_by)) from public.rfqs),
 'quotes', (select json_agg(json_build_array(id, supplier_id, amount, status)) from public.quotes),
 'suppliers', (select json_agg(id) from public.suppliers),
 'proposal', (select json_build_array(id, client_id, status) from public.proposals limit 1),
 'sections', (select json_agg(id) from public.proposal_sections),
 'items', (select json_agg(json_build_array(id, quantity, unit_cost, unit_price, is_optional)) from public.proposal_items),
 'inventory', (select json_agg(json_build_array(id, quantity, unit_rate)) from public.inventory_items),
 'invoices', (select json_agg(json_build_array(id, amount, status, due_date)) from public.invoices),
 'expenses', (select json_agg(json_build_array(id, amount)) from public.expenses),
 'tasks', (select json_agg(json_build_array(project_id, status, due_date)) from public.tasks),
 'milestones', (select json_agg(project_id) from public.milestones),
 'activity', (select json_agg(json_build_array(project_id, entity_type, n)) from (select project_id, entity_type, count(*) n from public.activity group by 1, 2) a)
) as mirror;
