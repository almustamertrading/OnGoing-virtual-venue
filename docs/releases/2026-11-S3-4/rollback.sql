-- ROLLBACK for release S3-4: reverses migrations 20261109190000_proposals_phase2_ai and
-- 20261109180000_stage3_modules, restoring the exact schema of production after release S1-5.
-- Verified on the isolated production-shaped mirror: schema dump and data fingerprint after
-- rollback are identical to before the migration (docs/releases/2026-11-S3-4/READINESS.md).
-- The definitions it restores are copied verbatim from that baseline schema dump.
--
-- Run as ONE transaction (psql -1, or the SQL editor runs a single batch). Any error rolls it back.
-- Nothing is lost: everything created after go-live (calendar events, documents, templates,
-- versions, reviews, AI usage, audit entries, organisation settings, proposal approvals) is first
-- copied into the private schema ops_rollback_s34, which client roles cannot read. Uploaded files
-- stay in storage; the documents bucket is removed only when it is empty.
-- After running it, redeploy the previous app version (release S1-5, commit d5d9727).

-- ===========================================================================
-- Part 0: keep a copy of everything the release added
-- ===========================================================================
create schema ops_rollback_s34;
revoke all on schema ops_rollback_s34 from public, anon, authenticated;
-- Rows are kept as JSON, so the copies do not depend on the types this rollback removes.
-- Restore later with jsonb_populate_record(null::<table>, row).
create table ops_rollback_s34.ai_usage_logs as select to_jsonb(t) as row from public.ai_usage_logs t;
create table ops_rollback_s34.proposal_templates as select to_jsonb(t) as row from public.proposal_templates t;
create table ops_rollback_s34.proposal_versions as select to_jsonb(t) as row from public.proposal_versions t;
create table ops_rollback_s34.proposal_reviews as select to_jsonb(t) as row from public.proposal_reviews t;
create table ops_rollback_s34.calendar_events as select to_jsonb(t) as row from public.calendar_events t;
create table ops_rollback_s34.documents as select to_jsonb(t) as row from public.documents t;
create table ops_rollback_s34.organization_audit as select to_jsonb(t) as row from public.organization_audit t;
create table ops_rollback_s34.organization_settings as
  select jsonb_build_object('id', id, 'timezone', timezone, 'default_vat_rate', default_vat_rate, 'tax_number', tax_number,
    'address', address, 'phone', phone, 'website', website, 'updated_at', updated_at) as row
  from public.organizations;
create table ops_rollback_s34.proposal_workflow as
  select jsonb_build_object('id', id, 'template_id', template_id, 'submitted_at', submitted_at, 'approved_by', approved_by,
    'approved_at', approved_at, 'version', version, 'status', status) as row
  from public.proposals;

-- ===========================================================================
-- Part A: reverse Proposal Builder Phase 2 + AI cost control (20261109190000)
-- ===========================================================================
drop trigger proposals_lock_content on public.proposals;
drop trigger proposals_workflow on public.proposals;
drop table public.proposal_reviews;
drop table public.proposal_versions;
drop function public.convert_proposal_to_project(uuid);
drop function private.proposals_lock_content();
drop function private.proposal_reviews_apply();
drop function private.proposals_workflow();
drop function public.save_proposal_version(uuid, text);
drop function private.proposal_snapshot(uuid);

-- Section and item policies back to the release S1-5 definitions (no workflow lock).
drop policy "proposal sections: sales add" on public.proposal_sections;
drop policy "proposal sections: sales update" on public.proposal_sections;
drop policy "proposal sections: sales delete" on public.proposal_sections;
CREATE POLICY "proposal sections: sales add" ON public.proposal_sections FOR INSERT TO authenticated WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND ( SELECT private.has_capability(proposal_sections.organization_id, 'sales_access'::public.capability) AS has_capability)));
CREATE POLICY "proposal sections: sales update" ON public.proposal_sections FOR UPDATE TO authenticated USING (( SELECT private.has_capability(proposal_sections.organization_id, 'sales_access'::public.capability) AS has_capability)) WITH CHECK (( SELECT private.has_capability(proposal_sections.organization_id, 'sales_access'::public.capability) AS has_capability));
CREATE POLICY "proposal sections: sales delete" ON public.proposal_sections FOR DELETE TO authenticated USING (( SELECT private.has_capability(proposal_sections.organization_id, 'sales_access'::public.capability) AS has_capability));
drop policy "proposal items: sales add" on public.proposal_items;
drop policy "proposal items: sales update" on public.proposal_items;
drop policy "proposal items: sales delete" on public.proposal_items;
CREATE POLICY "proposal items: sales add" ON public.proposal_items FOR INSERT TO authenticated WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND ( SELECT private.has_capability(proposal_items.organization_id, 'sales_access'::public.capability) AS has_capability)));
CREATE POLICY "proposal items: sales update" ON public.proposal_items FOR UPDATE TO authenticated USING (( SELECT private.has_capability(proposal_items.organization_id, 'sales_access'::public.capability) AS has_capability)) WITH CHECK (( SELECT private.has_capability(proposal_items.organization_id, 'sales_access'::public.capability) AS has_capability));
CREATE POLICY "proposal items: sales delete" ON public.proposal_items FOR DELETE TO authenticated USING (( SELECT private.has_capability(proposal_items.organization_id, 'sales_access'::public.capability) AS has_capability));
drop function private.proposal_is_editable(uuid);

alter table public.proposals
  drop constraint proposals_template_fk,
  drop column template_id,
  drop column submitted_at,
  drop column approved_by,
  drop column approved_at;
drop table public.proposal_templates;
drop function public.ai_org_tokens_this_month(uuid);
drop table public.ai_usage_logs;
drop function private.ai_usage_logs_guard();

-- ===========================================================================
-- Part B: reverse Stage 3 modules (20261109180000)
-- ===========================================================================
alter table public.organization_domains drop constraint organization_domains_not_public_provider;

-- Activity feed: the release S1-5 logger and read policy.
drop policy "activity: members read" on public.activity;
CREATE POLICY "activity: members read" ON public.activity FOR SELECT TO authenticated USING ((( SELECT private.is_member(activity.project_id) AS is_member) AND ((entity_type <> ALL (ARRAY['invoices'::text, 'expenses'::text, 'quotes'::text])) OR ( SELECT private.can_access_project_finance(activity.project_id) AS can_access_project_finance))));
CREATE OR REPLACE FUNCTION private.log_activity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  rec jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  prev jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  pid uuid;
  changed text[];
  label text;
  ignored text[] := array['updated_at', 'updated_by', 'geom', 'completed_at', 'sort_order'];
  info jsonb;
begin
  pid := case when tg_table_name = 'projects' then (rec ->> 'id')::uuid else (rec ->> 'project_id')::uuid end;
  -- Skip rows whose project is being deleted in the same statement.
  if pid is null or not exists (select 1 from public.projects p where p.id = pid) then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    select array_agg(key order by key) into changed
    from jsonb_each(rec) n
    where not (n.key = any (ignored)) and n.value is distinct from prev -> n.key;
    if changed is null then
      return null;
    end if;
    -- Map shapes change on every drag; only renames and layer moves are worth a line.
    if tg_table_name = 'features' and not (changed && array['name', 'layer_id']) then
      return null;
    end if;
  end if;

  label := coalesce(rec ->> 'title', rec ->> 'name', rec ->> 'body', '');
  info := jsonb_build_object('label', left(label, 140));
  if changed is not null then
    info := info || jsonb_build_object('changed', to_jsonb(changed));
    if 'status' = any (changed) then
      info := info || jsonb_build_object('from', prev ->> 'status', 'to', rec ->> 'status');
    end if;
  end if;
  if tg_table_name = 'project_members' then
    info := info || jsonb_build_object(
      'member', (select p.email from public.profiles p where p.id = (rec ->> 'user_id')::uuid),
      'role', rec ->> 'role'
    );
  end if;

  insert into public.activity (project_id, actor_id, action, entity_type, entity_id, details)
  values (
    pid,
    (select auth.uid()),
    case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    tg_table_name,
    case when tg_table_name = 'project_members' then (rec ->> 'user_id')::uuid else (rec ->> 'id')::uuid end,
    info
  );
  return null;
end;
$$;

drop function public.report_procurement(uuid);
drop function public.report_delivery(uuid);
drop function public.report_project_finance(uuid);
drop function public.report_proposals(uuid);
drop function public.report_pipeline(uuid);

drop policy "documents bucket: uploader sees own unclaimed objects" on storage.objects;
drop policy "documents bucket: delete" on storage.objects;
drop policy "documents bucket: upload" on storage.objects;
drop policy "documents bucket: read via document row" on storage.objects;
drop function private.document_path_claimed(text);
drop function private.can_write_document_path(text);
-- The bucket goes only when it holds no files (deleting file rows by SQL would orphan the files).
do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'documents') then
    raise notice 'documents bucket kept: it holds uploaded files (their rows are in ops_rollback_s34.documents)';
  else
    perform set_config('storage.allow_delete_query', 'true', true);
    delete from storage.buckets where id = 'documents';
  end if;
end;
$$;
drop table public.documents;
drop type public.document_category;

drop function public.calendar_feed(uuid, date, date);
drop table public.calendar_events;
drop type public.calendar_event_kind;

drop trigger organizations_audit on public.organizations;
drop trigger organization_domains_audit on public.organization_domains;
drop trigger organization_members_audit on public.organization_members;
drop function private.audit_organization_change();
drop table public.organization_audit;

drop trigger organizations_before_update on public.organizations;
drop function private.organizations_before_update();
alter table public.organizations
  drop column timezone,
  drop column default_vat_rate,
  drop column tax_number,
  drop column address,
  drop column phone,
  drop column website,
  drop column updated_at;
drop function private.can_contribute(uuid);

-- Migration history: forget the two migrations so the history matches the schema again.
-- (Production records apply-time versions; the names identify them either way.)
delete from supabase_migrations.schema_migrations
where version in ('20261109180000', '20261109190000') or name in ('stage3_modules', 'proposals_phase2_ai');
