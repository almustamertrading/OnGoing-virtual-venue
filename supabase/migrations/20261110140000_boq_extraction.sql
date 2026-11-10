-- BOQ intelligence (Workflow B, increment 2): bill-of-quantities lines extracted by AI from a tender PDF are
-- findings with their page and quoted text. A line joins the project's BOQ only when a project editor accepts
-- it: that acceptance is the human verification of the quantity, recorded with who and when on the finding.
-- The BOQ row keeps the client's item reference, where it came from, and a link to the finding.
-- Also: a record may only link to a finding of its own project (tenant integrity, as in S-08).

alter table public.ai_usage_logs drop constraint ai_usage_logs_feature_check;
alter table public.ai_usage_logs add constraint ai_usage_logs_feature_check
  check (feature in ('rfp_extract', 'proposal_draft', 'tender_analysis', 'ops_extract', 'management_brief', 'boq_extract'));

alter table public.boq_items
  add column item_ref text not null default '' check (char_length(item_ref) <= 40),
  add column source_ref text not null default '' check (char_length(source_ref) <= 400),
  add column finding_id uuid references public.ai_findings (id) on delete set null;
create index boq_items_finding_id_idx on public.boq_items (finding_id);

-- A finding link must point to a finding of the same project (checked without RLS, so the rule holds for
-- every caller; it reveals nothing beyond yes/no).
create or replace function private.finding_link_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.finding_id is not null and (tg_op = 'INSERT' or new.finding_id is distinct from old.finding_id) then
    if not exists (select 1 from public.ai_findings f where f.id = new.finding_id and f.project_id = new.project_id) then
      raise exception 'A linked AI finding must belong to the same project' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.finding_link_check() from public, anon, authenticated;

create trigger boq_items_finding_link before insert or update of finding_id, project_id on public.boq_items
  for each row execute function private.finding_link_check();
create trigger project_requirements_finding_link before insert or update of finding_id, project_id on public.project_requirements
  for each row execute function private.finding_link_check();
create trigger project_risks_finding_link before insert or update of finding_id, project_id on public.project_risks
  for each row execute function private.finding_link_check();

-- Accepting an extracted line adds it to the BOQ, in one transaction. Runs as the caller: RLS decides (only
-- project editors can lock and update the finding and insert BOQ lines). The quantity is taken as extracted;
-- the editor corrects it in the BOQ afterwards if needed. Prices are never extracted.
create or replace function public.accept_finding_as_boq_item(fid uuid, note text default '')
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  f public.ai_findings;
  qty numeric(14, 2);
  doc_title text;
  next_order double precision;
  bid uuid;
begin
  select * into f from public.ai_findings where id = fid for update;
  if f.id is null then
    raise exception 'Finding not found or not editable by you' using errcode = '42501';
  end if;
  if f.workflow <> 'boq' or f.kind <> 'boq_line' or f.project_id is null then
    raise exception 'Only extracted BOQ lines join the BOQ' using errcode = '22023';
  end if;
  if f.status <> 'proposed' then
    raise exception 'This finding was already reviewed' using errcode = '22023';
  end if;
  if (f.data ->> 'quantity') ~ '^\d{1,12}(\.\d{1,2})?$' then
    qty := (f.data ->> 'quantity')::numeric(14, 2);
  end if;
  select d.title into doc_title from public.documents d where d.id = f.document_id;
  select coalesce(max(b.sort_order), 0) + 1 into next_order from public.boq_items b where b.project_id = f.project_id;
  insert into public.boq_items (project_id, description, unit, quantity, item_ref, source_ref, finding_id, sort_order)
  values (
    f.project_id,
    left(f.title, 500),
    left(coalesce(f.data ->> 'unit', ''), 40),
    qty,
    left(coalesce(f.data ->> 'item_ref', ''), 40),
    left(concat_ws(' · ', doc_title, case when f.source_page is not null then 'صفحة ' || f.source_page end), 400),
    f.id,
    next_order
  )
  returning id into bid;
  update public.ai_findings
  set status = 'accepted', review_note = left(coalesce(note, ''), 1000), target_table = 'boq_items', target_id = bid
  where id = fid;
  return bid;
end;
$$;
revoke execute on function public.accept_finding_as_boq_item(uuid, text) from public, anon;
grant execute on function public.accept_finding_as_boq_item(uuid, text) to authenticated;
