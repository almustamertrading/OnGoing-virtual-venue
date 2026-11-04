-- A company can own several email domains; new users on any of them join automatically.

create table public.organization_domains (
  domain text primary key check (domain = lower(domain) and domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$'),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index organization_domains_organization_id_idx on public.organization_domains (organization_id);

insert into public.organization_domains (domain, organization_id)
select o.email_domain, o.id from public.organizations o where o.email_domain is not null
on conflict do nothing;

insert into public.organization_domains (domain, organization_id)
select 'futuresceneksa.com', o.id from public.organizations o where o.email_domain = 'ongoingevent.com'
on conflict do nothing;

comment on column public.organizations.email_domain is
  'Primary email domain, for display. Automatic membership uses organization_domains.';

alter table public.organization_domains enable row level security;
create policy "org domains: members read" on public.organization_domains
  for select to authenticated using ((select private.is_org_member(organization_id)));
create policy "org domains: admins add" on public.organization_domains
  for insert to authenticated with check ((select private.is_org_admin(organization_id)));
create policy "org domains: admins remove" on public.organization_domains
  for delete to authenticated using ((select private.is_org_admin(organization_id)));
revoke all on public.organization_domains from anon;
grant select, insert, delete on public.organization_domains to authenticated;

-- New users join the organisation that owns their email domain; the first one is its admin.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_domain text := lower(split_part(coalesce(new.email, ''), '@', 2));
  org uuid;
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), '')
  )
  on conflict (id) do update set email = excluded.email;

  if user_domain <> '' then
    select d.organization_id into org from public.organization_domains d where d.domain = user_domain;
    if org is not null then
      insert into public.organization_members (organization_id, user_id, role)
      values (
        org,
        new.id,
        case when exists (select 1 from public.organization_members x where x.organization_id = org)
             then 'staff'::public.org_role else 'admin'::public.org_role end
      )
      on conflict (organization_id, user_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

-- Anyone already signed up on a newly added domain joins now.
insert into public.organization_members (organization_id, user_id, role)
select d.organization_id, u.id, 'staff'
from auth.users u
join public.organization_domains d on d.domain = lower(split_part(u.email, '@', 2))
on conflict do nothing;
