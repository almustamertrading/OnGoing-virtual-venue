-- Restore records removed by a cleanup, from the 2026-11-09 snapshot (schema ops_backup_20261109).
-- Edit the three ID arrays, then run the whole file. Parents are restored before children.
-- Uses only columns present in BOTH the live table and the snapshot (tolerates later schema
-- changes), skips generated columns, and keeps original identity values.
-- Note: inserts fire the activity triggers, so the audit log records the restore itself.

begin;

do $$
declare
  v_projects uuid[] := array[
    '68d00ba1-c58d-429a-9bc4-cef6ca801768',
    '50a9f40f-e659-4dbb-b68b-1bec2070a9b2',
    'a938a179-d440-4baa-b159-f0db3981664d',
    '6fe7d360-eaec-4cda-9e43-9004e68aa80f'
  ]::uuid[];
  v_clients uuid[] := array[
    '71b29a9e-c478-4102-8aa3-c8f38d0218d9',
    '0647b50a-60ed-4cf5-abe4-d06fa3872656'
  ]::uuid[];
  v_users uuid[] := array[
    'f0b3270f-4580-4334-bfdf-5729a378cfb9',
    '703fd035-6d3d-426c-aa7b-4b760f24c0ca',
    'dd88c9dd-94a9-42a5-a2b0-b27a67646efc'
  ]::uuid[];
  t record;
  cols text;
  n int;
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'ops_backup_20261109') then
    raise exception 'Snapshot schema ops_backup_20261109 is missing';
  end if;

  for t in
    select * from (values
      (1,  'auth',   'users',               'auth_users',           'id = any($3)'),
      (2,  'public', 'profiles',            'profiles',             'id = any($3)'),
      (3,  'public', 'organization_members','organization_members', 'user_id = any($3)'),
      (4,  'public', 'clients',             'clients',              'id = any($2)'),
      (5,  'public', 'projects',            'projects',             'id = any($1)'),
      (6,  'public', 'project_members',     'project_members',      'project_id = any($1) or user_id = any($3)'),
      (7,  'public', 'scope_items',         'scope_items',          'project_id = any($1)'),
      (8,  'public', 'milestones',          'milestones',           'project_id = any($1)'),
      (9,  'public', 'tasks',               'tasks',                'project_id = any($1)'),
      (10, 'public', 'venues',              'venues',               'project_id = any($1)'),
      (11, 'public', 'layers',              'layers',               'project_id = any($1)'),
      (12, 'public', 'features',            'features',             'project_id = any($1)'),
      (13, 'public', 'comments',            'comments',             'project_id = any($1)'),
      (14, 'public', 'panoramas',           'panoramas',            'project_id = any($1)'),
      (15, 'public', 'layouts',             'layouts',              'project_id = any($1)'),
      (16, 'public', 'layout_items',        'layout_items',         'project_id = any($1)'),
      (17, 'public', 'boq_items',           'boq_items',            'project_id = any($1)'),
      (18, 'public', 'plan_phases',         'plan_phases',          'project_id = any($1)'),
      (19, 'public', 'team_roles',          'team_roles',           'project_id = any($1)'),
      (20, 'public', 'evaluation_criteria', 'evaluation_criteria',  'project_id = any($1)'),
      (21, 'public', 'rfqs',                'rfqs',                 'project_id = any($1)'),
      (22, 'public', 'quotes',              'quotes',               'project_id = any($1)'),
      (23, 'public', 'invoices',            'invoices',             'project_id = any($1)'),
      (24, 'public', 'expenses',            'expenses',             'project_id = any($1)'),
      (25, 'public', 'activity',            'activity',             'project_id = any($1)')
    ) as x(ord, live_schema, live_table, snap_table, filter)
    order by ord
  loop
    select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position) into cols
    from information_schema.columns c
    where c.table_schema = t.live_schema and c.table_name = t.live_table
      and c.is_generated = 'NEVER'
      and exists (select 1 from information_schema.columns s
                  where s.table_schema = 'ops_backup_20261109' and s.table_name = t.snap_table
                    and s.column_name = c.column_name);

    execute format(
      'insert into %I.%I (%s) overriding system value select %s from ops_backup_20261109.%I where %s on conflict do nothing',
      t.live_schema, t.live_table, cols, cols, t.snap_table, t.filter
    ) using v_projects, v_clients, v_users;
    get diagnostics n = row_count;
    raise notice 'restored % row(s) into %.%', n, t.live_schema, t.live_table;
  end loop;
end $$;

commit;
