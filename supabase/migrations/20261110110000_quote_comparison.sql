-- Workflow D: like-for-like supplier quote comparison and a recorded, human award decision.
-- AI or rules may recommend; only a person (project editor with finance access) awards, with a reason.
-- Quotes stay finance-only (existing policies).

alter table public.quotes
  add column scope_basis text not null default 'unspecified'
    check (scope_basis in ('unspecified', 'supply_only', 'supply_install', 'service', 'rental')),
  add column exclusions text not null default '' check (char_length(exclusions) <= 2000),
  add column valid_until date,
  add column lead_time_days integer check (lead_time_days is null or lead_time_days between 0 and 730),
  add column payment_terms text not null default '' check (char_length(payment_terms) <= 300),
  add column award_reason text not null default '' check (char_length(award_reason) <= 1000),
  add column awarded_by uuid references auth.users (id) on delete set null,
  add column awarded_at timestamptz;
create index quotes_awarded_by_idx on public.quotes (awarded_by);
-- One awarded quote per RFQ.
create unique index quotes_one_award_per_rfq on public.quotes (rfq_id) where status = 'accepted';

-- Award details are written here only: who and when come from the session, and an award needs a reason.
create or replace function private.quotes_award_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    return new; -- service role and migrations
  end if;
  if tg_op = 'INSERT' then
    if new.status = 'accepted' then
      raise exception 'A quote is awarded through the award step, with a reason' using errcode = '42501';
    end if;
    new.awarded_by := null;
    new.awarded_at := null;
    new.award_reason := '';
    return new;
  end if;

  if new.status is not distinct from old.status then
    if new.awarded_at is distinct from old.awarded_at
       or (new.awarded_by is distinct from old.awarded_by and new.awarded_by is not null)
       or new.award_reason is distinct from old.award_reason then
      raise exception 'Award details are recorded only with an award decision' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status = 'accepted' then
    if char_length(trim(coalesce(new.award_reason, ''))) = 0 then
      raise exception 'An award needs a reason' using errcode = '23514';
    end if;
    new.awarded_by := caller;
    new.awarded_at := now();
  elsif old.status = 'accepted' then
    new.awarded_by := null;
    new.awarded_at := null;
    new.award_reason := '';
  end if;
  return new;
end;
$$;
revoke execute on function private.quotes_award_guard() from public, anon, authenticated;
create trigger quotes_award_guard before insert or update on public.quotes
  for each row execute function private.quotes_award_guard();

-- Awarding, in one transaction: the other quotes in the RFQ are set aside, this one is awarded with the
-- reason, and the RFQ is marked awarded. Runs as the caller, so RLS decides who can see and change what.
create or replace function public.award_quote(qid uuid, reason text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  q public.quotes;
begin
  select * into q from public.quotes where id = qid for update;
  if q.id is null then
    raise exception 'Quote not found or not visible to you' using errcode = '42501';
  end if;
  if not private.can_edit(q.project_id) then
    raise exception 'Only project editors with finance access can award a quote' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(reason, ''))) = 0 then
    raise exception 'An award needs a reason' using errcode = '23514';
  end if;
  if q.amount is null then
    raise exception 'A quote without a price cannot be awarded' using errcode = '22023';
  end if;
  update public.quotes set status = 'rejected' where rfq_id = q.rfq_id and id <> q.id and status <> 'rejected';
  update public.quotes set status = 'accepted', award_reason = left(trim(reason), 1000) where id = q.id;
  update public.rfqs set status = 'awarded' where id = q.rfq_id;
end;
$$;
revoke execute on function public.award_quote(uuid, text) from public, anon;
grant execute on function public.award_quote(uuid, text) to authenticated;
