-- Storage configuration the release touches: buckets and storage policies.
select 'bucket|' || id || '|' || public || '|' || coalesce(file_size_limit::text, '') from storage.buckets
union all
select 'policy|' || policyname || '|' || cmd || '|' || coalesce(qual, '') || '|' || coalesce(with_check, '') from pg_policies where schemaname = 'storage'
order by 1;
