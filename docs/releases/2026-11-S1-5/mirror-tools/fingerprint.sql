-- Data fingerprint: row counts and an order-independent hash of every row's full content.
select format('%s|%s|%s', c.relname,
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', c.relname), false, true, '')))[1]::text,
  (xpath('/row/h/text()', query_to_xml(format(
     'select coalesce(md5(string_agg(md5(t::text), '''' order by md5(t::text))), ''empty'') as h from public.%I t', c.relname), false, true, '')))[1]::text)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname not in ('proposal_item_costs', 'inventory_item_costs')
order by c.relname;
