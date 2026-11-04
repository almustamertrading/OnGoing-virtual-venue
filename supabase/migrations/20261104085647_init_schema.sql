-- OnGoing Virtual Venue: initial schema
-- Events contain venues; venues contain layers, map features, comments and 360° panoramas.
-- Every child row carries event_id (and venue_id) so RLS and realtime filters stay cheap.

create extension if not exists postgis with schema extensions;

create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  description text,
  start_date date,
  end_date date,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index events_created_by_idx on public.events (created_by);

create type public.member_role as enum ('owner', 'editor', 'viewer');

create table public.event_members (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_members_user_id_idx on public.event_members (user_id);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  address text,
  center_lng double precision not null check (center_lng between -180 and 180),
  center_lat double precision not null check (center_lat between -90 and 90),
  zoom double precision not null default 16,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, event_id)
);
create index venues_event_id_idx on public.venues (event_id);

create table public.layers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  venue_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  color text not null default '#3b82f6' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (venue_id, event_id) references public.venues (id, event_id) on delete cascade,
  unique (id, venue_id, event_id)
);
create index layers_venue_id_idx on public.layers (venue_id, event_id);
create index layers_event_id_idx on public.layers (event_id);

create table public.features (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  venue_id uuid not null,
  layer_id uuid not null,
  name text not null default '',
  notes text not null default '',
  -- GeoJSON geometry as sent by the browser; geom is derived for spatial queries.
  geometry jsonb not null,
  geom extensions.geometry(Geometry, 4326)
    generated always as (extensions.st_setsrid(extensions.st_geomfromgeojson(geometry), 4326)) stored,
  properties jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users (id),
  updated_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (layer_id, venue_id, event_id)
    references public.layers (id, venue_id, event_id) on delete cascade,
  check (geometry ->> 'type' in ('Point', 'LineString', 'Polygon'))
);
create index features_layer_idx on public.features (layer_id, venue_id, event_id);
create index features_venue_id_idx on public.features (venue_id);
create index features_event_id_idx on public.features (event_id);
create index features_geom_idx on public.features using gist (geom);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  venue_id uuid not null,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  lng double precision check (lng between -180 and 180),
  lat double precision check (lat between -90 and 90),
  resolved boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (venue_id, event_id) references public.venues (id, event_id) on delete cascade,
  -- top-level comments are pinned to the map, replies inherit the parent's pin
  check ((parent_id is null) = (lng is not null and lat is not null))
);
create index comments_venue_idx on public.comments (venue_id, event_id);
create index comments_event_id_idx on public.comments (event_id);
create index comments_parent_id_idx on public.comments (parent_id);

create table public.panoramas (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  venue_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  lng double precision not null check (lng between -180 and 180),
  lat double precision not null check (lat between -90 and 90),
  storage_path text not null unique,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (venue_id, event_id) references public.venues (id, event_id) on delete cascade,
  -- files live under <event_id>/ in the panoramas bucket
  check (split_part(storage_path, '/', 1) = event_id::text)
);
create index panoramas_venue_idx on public.panoramas (venue_id, event_id);
create index panoramas_event_id_idx on public.panoramas (event_id);

-- created_by / updated_by foreign keys
create index venues_created_by_idx on public.venues (created_by);
create index layers_created_by_idx on public.layers (created_by);
create index features_created_by_idx on public.features (created_by);
create index features_updated_by_idx on public.features (updated_by);
create index comments_created_by_idx on public.comments (created_by);
create index panoramas_created_by_idx on public.panoramas (created_by);

-- ---------------------------------------------------------------------------
-- Helper functions (private schema, not exposed through the Data API)
-- ---------------------------------------------------------------------------

create or replace function private.event_role(eid uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.event_members m
  where m.event_id = eid and m.user_id = (select auth.uid());
$$;

create or replace function private.is_member(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_members m
    where m.event_id = eid and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.can_edit(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_members m
    where m.event_id = eid and m.user_id = (select auth.uid())
      and m.role in ('owner', 'editor')
  );
$$;

create or replace function private.is_owner(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_members m
    where m.event_id = eid and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

create or replace function private.shares_event(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_members mine
    join public.event_members theirs on theirs.event_id = mine.event_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other
  );
$$;

revoke execute on function private.event_role(uuid), private.is_member(uuid), private.can_edit(uuid),
  private.is_owner(uuid), private.shares_event(uuid) from public, anon;
grant execute on function private.event_role(uuid), private.is_member(uuid), private.can_edit(uuid),
  private.is_owner(uuid), private.shares_event(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger events_updated_at before update on public.events
  for each row execute function private.set_updated_at();
create trigger venues_updated_at before update on public.venues
  for each row execute function private.set_updated_at();
create trigger layers_updated_at before update on public.layers
  for each row execute function private.set_updated_at();
create trigger comments_updated_at before update on public.comments
  for each row execute function private.set_updated_at();
create trigger panoramas_updated_at before update on public.panoramas
  for each row execute function private.set_updated_at();

create or replace function private.features_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;
create trigger features_touch before update on public.features
  for each row execute function private.features_touch();

-- The creator of an event becomes its owner.
create or replace function private.add_event_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.event_members (event_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (event_id, user_id) do update set role = 'owner';
  return new;
end;
$$;
create trigger events_add_owner after insert on public.events
  for each row execute function private.add_event_owner();

-- Keep a public profile row for every auth user.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
create trigger on_auth_user_created after insert or update of email on auth.users
  for each row execute function private.handle_new_user();

insert into public.profiles (id, email, display_name)
select u.id, coalesce(u.email, ''), nullif(split_part(coalesce(u.email, ''), '@', 1), '')
from auth.users u
on conflict (id) do nothing;

revoke execute on function private.set_updated_at(), private.features_touch(),
  private.add_event_owner(), private.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Member management RPCs
-- ---------------------------------------------------------------------------

-- Owners add an existing user to an event by email.
create or replace function private.add_member_by_email(eid uuid, member_email text, member_role public.member_role)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.event_members m
    where m.event_id = eid and m.user_id = (select auth.uid()) and m.role = 'owner'
  ) then
    raise exception 'Only event owners can add members' using errcode = '42501';
  end if;

  select p.id into target from public.profiles p where lower(p.email) = lower(trim(member_email));
  if target is null then
    raise exception 'No account found for %. Ask them to sign up first.', member_email using errcode = 'P0002';
  end if;

  insert into public.event_members (event_id, user_id, role)
  values (eid, target, member_role)
  on conflict (event_id, user_id) do update set role = excluded.role;
  return target;
end;
$$;
revoke execute on function private.add_member_by_email(uuid, text, public.member_role) from public, anon;
grant execute on function private.add_member_by_email(uuid, text, public.member_role) to authenticated;

create or replace function public.add_member_by_email(eid uuid, member_email text, member_role public.member_role default 'editor')
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.add_member_by_email(eid, member_email, member_role);
$$;
revoke execute on function public.add_member_by_email(uuid, text, public.member_role) from public, anon;
grant execute on function public.add_member_by_email(uuid, text, public.member_role) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.venues enable row level security;
alter table public.layers enable row level security;
alter table public.features enable row level security;
alter table public.comments enable row level security;
alter table public.panoramas enable row level security;

-- profiles
create policy "profiles: read self and co-members" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.shares_event(id)));
create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- events
create policy "events: members read" on public.events
  for select to authenticated
  using (created_by = (select auth.uid()) or (select private.is_member(id)));
create policy "events: signed-in users create" on public.events
  for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "events: owners update" on public.events
  for update to authenticated
  using ((select private.is_owner(id)))
  with check ((select private.is_owner(id)));
create policy "events: owners delete" on public.events
  for delete to authenticated
  using ((select private.is_owner(id)));

-- event_members
create policy "members: members read" on public.event_members
  for select to authenticated
  using ((select private.is_member(event_id)));
create policy "members: owners add" on public.event_members
  for insert to authenticated
  with check ((select private.is_owner(event_id)));
create policy "members: owners change roles" on public.event_members
  for update to authenticated
  using ((select private.is_owner(event_id)))
  with check ((select private.is_owner(event_id)));
create policy "members: owners remove, members leave" on public.event_members
  for delete to authenticated
  using ((select private.is_owner(event_id)) or user_id = (select auth.uid()));

-- venues, layers, features, panoramas: members read, owners/editors write
create policy "venues: members read" on public.venues
  for select to authenticated using ((select private.is_member(event_id)));
create policy "venues: editors insert" on public.venues
  for insert to authenticated with check ((select private.can_edit(event_id)));
create policy "venues: editors update" on public.venues
  for update to authenticated
  using ((select private.can_edit(event_id))) with check ((select private.can_edit(event_id)));
create policy "venues: editors delete" on public.venues
  for delete to authenticated using ((select private.can_edit(event_id)));

create policy "layers: members read" on public.layers
  for select to authenticated using ((select private.is_member(event_id)));
create policy "layers: editors insert" on public.layers
  for insert to authenticated with check ((select private.can_edit(event_id)));
create policy "layers: editors update" on public.layers
  for update to authenticated
  using ((select private.can_edit(event_id))) with check ((select private.can_edit(event_id)));
create policy "layers: editors delete" on public.layers
  for delete to authenticated using ((select private.can_edit(event_id)));

create policy "features: members read" on public.features
  for select to authenticated using ((select private.is_member(event_id)));
create policy "features: editors insert" on public.features
  for insert to authenticated with check ((select private.can_edit(event_id)));
create policy "features: editors update" on public.features
  for update to authenticated
  using ((select private.can_edit(event_id))) with check ((select private.can_edit(event_id)));
create policy "features: editors delete" on public.features
  for delete to authenticated using ((select private.can_edit(event_id)));

create policy "panoramas: members read" on public.panoramas
  for select to authenticated using ((select private.is_member(event_id)));
create policy "panoramas: editors insert" on public.panoramas
  for insert to authenticated with check ((select private.can_edit(event_id)));
create policy "panoramas: editors update" on public.panoramas
  for update to authenticated
  using ((select private.can_edit(event_id))) with check ((select private.can_edit(event_id)));
create policy "panoramas: editors delete" on public.panoramas
  for delete to authenticated using ((select private.can_edit(event_id)));

-- comments: any member (viewers included) can comment; authors and editors can edit
create policy "comments: members read" on public.comments
  for select to authenticated using ((select private.is_member(event_id)));
create policy "comments: members insert own" on public.comments
  for insert to authenticated
  with check ((select private.is_member(event_id)) and created_by = (select auth.uid()));
create policy "comments: authors or editors update" on public.comments
  for update to authenticated
  using ((select private.is_member(event_id))
         and (created_by = (select auth.uid()) or (select private.can_edit(event_id))))
  with check ((select private.is_member(event_id)));
create policy "comments: authors or editors delete" on public.comments
  for delete to authenticated
  using (created_by = (select auth.uid()) or (select private.can_edit(event_id)));

-- ---------------------------------------------------------------------------
-- Data API grants (signed-in users only; anon gets nothing)
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.events, public.event_members, public.venues,
  public.layers, public.features, public.comments, public.panoramas from anon;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.events, public.event_members, public.venues,
  public.layers, public.features, public.comments, public.panoramas to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.layers, public.features,
  public.comments, public.panoramas, public.venues;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for 360° panoramas, files under <event_id>/...
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('panoramas', 'panoramas', false, 52428800, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.storage_event_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;
revoke execute on function private.storage_event_id(text) from public, anon;
grant execute on function private.storage_event_id(text) to authenticated;

create policy "panoramas bucket: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'panoramas' and (select private.is_member(private.storage_event_id(name))));
create policy "panoramas bucket: editors upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'panoramas' and (select private.can_edit(private.storage_event_id(name))));
create policy "panoramas bucket: editors replace" on storage.objects
  for update to authenticated
  using (bucket_id = 'panoramas' and (select private.can_edit(private.storage_event_id(name))))
  with check (bucket_id = 'panoramas' and (select private.can_edit(private.storage_event_id(name))));
create policy "panoramas bucket: editors delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'panoramas' and (select private.can_edit(private.storage_event_id(name))));
