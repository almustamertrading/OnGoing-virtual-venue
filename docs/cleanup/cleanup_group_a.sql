-- OnGoing production cleanup — GROUP A (QA / test artifacts).
-- STATUS: PROPOSED ONLY. Do NOT run until the owner approves this exact list.
-- Restore source: schema ops_backup_20261109 (verified snapshot, 31/31 tables, 430/430 rows).
-- The whole script is one transaction: any FK error rolls everything back.

begin;

do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'ops_backup_20261109') then
    raise exception 'Refusing to run: snapshot schema ops_backup_20261109 is missing';
  end if;
end $$;

-- A1. QA projects. Children cascade (scope, tasks, milestones, venues, layers, features,
--     comments, panorama rows, layouts, layout items, BOQ, plan, roles, KPIs, RFQs, quotes,
--     invoices, expenses, members, activity). Proposals pointing at them are set to NULL.
delete from public.projects where id in (
  '68d00ba1-c58d-429a-9bc4-cef6ca801768',  -- 2027-001  E2E test run #1
  '50a9f40f-e659-4dbb-b68b-1bec2070a9b2',  -- 2027-002  E2E test run #2
  'a938a179-d440-4baa-b159-f0db3981664d',  -- 2027-003  E2E test run #3 (map + 360° test)
  '6fe7d360-eaec-4cda-9e43-9004e68aa80f'   -- 2027-004  Layout editor demo (created by QA account)
);

-- A2. Clients referenced only by the QA projects above.
delete from public.clients where id in (
  '71b29a9e-c478-4102-8aa3-c8f38d0218d9',  -- E2E test client
  '0647b50a-60ed-4cf5-abe4-d06fa3872656'   -- QA demo client (created by QA account)
);

-- A3. QA account's leftover owner grant on project 2022-001.
delete from public.project_members
where user_id = 'f0b3270f-4580-4334-bfdf-5729a378cfb9'
  and project_id = '02784466-8f7d-44e0-81a6-22c135b55fe7';

-- A4. QA accounts. Any remaining created_by reference makes this fail and roll back.
delete from auth.users where id in (
  'f0b3270f-4580-4334-bfdf-5729a378cfb9',  -- layout.demo@ (QA; banned 2026-11-09)
  '703fd035-6d3d-426c-aa7b-4b760f24c0ca',  -- partner viewer QA account (.test domain)
  'dd88c9dd-94a9-42a5-a2b0-b27a67646efc'   -- staff editor QA account
);

commit;

-- Storage objects are not removed by SQL. Delete via the Storage API or dashboard after approval:
--   layouts/6fe7d360-…/512920d9-….png      demo floor plan (26 KB)
--   panoramas/a938a179-…/…/….jpeg           E2E 360° test photo (2.8 MB)
--   rfp-uploads/5ac7937e-…/eb89b5f1-….pdf   orphaned temp file from a failed RFP read (672 KB)
