-- Proposal Builder (Phase 1): organisation-level proposals with content sections
-- and a BOQ/financial table, an auto reference (ONG-PRO-YYYY-NNNN), status
-- lifecycle, and a link to the project an accepted proposal becomes.

create type public.proposal_type as enum (
  'technical_financial', 'creative_concept', 'boq_quotation',
  'rfp_response', 'sponsorship', 'venue_operations'
);
create type public.proposal_status as enum (
  'draft', 'ai_generated', 'under_review', 'changes_requested',
  'approved_internally', 'sent_to_client', 'awaiting_response',
  'accepted', 'rejected', 'expired', 'converted'
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid,
  project_id uuid references public.projects (id) on delete set null,
  reference text,
  title text not null check (char_length(title) between 1 and 300),
  proposal_type public.proposal_type not null default 'technical_financial',
  status public.proposal_status not null default 'draft',
  summary text not null default '',
  brief text not null default '',
  vat_rate numeric(5, 2) not null default 15,
  owner_id uuid references auth.users (id) on delete set null,
  issue_date date,
  due_date date,
  valid_until date,
  version integer not null default 1,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference),
  constraint proposals_client_fk foreign key (client_id, organization_id)
    references public.clients (id, organization_id)
);
create index proposals_organization_id_idx on public.proposals (organization_id);
create index proposals_client_idx on public.proposals (client_id);
create index proposals_project_idx on public.proposals (project_id);
create index proposals_created_by_idx on public.proposals (created_by);
create trigger proposals_updated_at before update on public.proposals
  for each row execute function private.set_updated_at();

-- Reference numbers look like ONG-PRO-2026-0001 (per org, per year).
create or replace function private.set_proposal_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  yr text := to_char(coalesce(new.issue_date, current_date), 'YYYY');
  n int;
begin
  if new.reference is not null and new.reference <> '' then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('prop' || new.organization_id::text || yr));
  select coalesce(max(substring(p.reference from '[0-9]+$')::int), 0) + 1 into n
  from public.proposals p
  where p.organization_id = new.organization_id
    and p.reference ~ ('^ONG-PRO-' || yr || '-[0-9]+$');
  new.reference := 'ONG-PRO-' || yr || '-' || lpad(n::text, 4, '0');
  return new;
end;
$$;
revoke execute on function private.set_proposal_reference() from public, anon, authenticated;
create trigger proposals_set_reference before insert on public.proposals
  for each row execute function private.set_proposal_reference();

create table public.proposal_sections (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  heading text not null default '',
  body text not null default '',
  ai_generated boolean not null default false,
  sort_order double precision not null default 0,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index proposal_sections_proposal_id_idx on public.proposal_sections (proposal_id);
create index proposal_sections_org_idx on public.proposal_sections (organization_id);
create trigger proposal_sections_updated_at before update on public.proposal_sections
  for each row execute function private.set_updated_at();

create table public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  category text not null default '',
  description text not null check (char_length(description) between 1 and 500),
  specification text not null default '',
  quantity numeric(14, 2) not null default 1,
  unit text not null default '',
  unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  supplier_id uuid references public.suppliers (id) on delete set null,
  is_optional boolean not null default false,
  sort_order double precision not null default 0,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index proposal_items_proposal_id_idx on public.proposal_items (proposal_id);
create index proposal_items_org_idx on public.proposal_items (organization_id);
create trigger proposal_items_updated_at before update on public.proposal_items
  for each row execute function private.set_updated_at();

-- RLS: organisation members manage their org's proposals.
alter table public.proposals enable row level security;
alter table public.proposal_sections enable row level security;
alter table public.proposal_items enable row level security;

create policy "proposals: org members read" on public.proposals
  for select to authenticated using ((select private.is_org_member(organization_id)));
create policy "proposals: org members add" on public.proposals
  for insert to authenticated
  with check ((select private.is_org_member(organization_id)) and created_by = (select auth.uid()));
create policy "proposals: org members update" on public.proposals
  for update to authenticated
  using ((select private.is_org_member(organization_id))) with check ((select private.is_org_member(organization_id)));
create policy "proposals: managers delete" on public.proposals
  for delete to authenticated using ((select private.is_org_manager(organization_id)));

create policy "proposal sections: org members read" on public.proposal_sections
  for select to authenticated using ((select private.is_org_member(organization_id)));
create policy "proposal sections: org members write" on public.proposal_sections
  for all to authenticated
  using ((select private.is_org_member(organization_id))) with check ((select private.is_org_member(organization_id)));

create policy "proposal items: org members read" on public.proposal_items
  for select to authenticated using ((select private.is_org_member(organization_id)));
create policy "proposal items: org members write" on public.proposal_items
  for all to authenticated
  using ((select private.is_org_member(organization_id))) with check ((select private.is_org_member(organization_id)));

revoke all on public.proposals, public.proposal_sections, public.proposal_items from anon;
grant select, insert, update, delete on public.proposals, public.proposal_sections, public.proposal_items to authenticated;

alter publication supabase_realtime add table public.proposals, public.proposal_sections, public.proposal_items;
alter table public.proposals replica identity full;
alter table public.proposal_sections replica identity full;
alter table public.proposal_items replica identity full;
