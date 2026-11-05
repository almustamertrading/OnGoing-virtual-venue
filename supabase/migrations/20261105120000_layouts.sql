-- Indoor venue layouts: place tables, stage, AVL, exits etc. on an uploaded
-- floor-plan background. Built on the same project/RLS/realtime patterns as the
-- rest of the workspace. Backgrounds live in a private `layouts` storage bucket
-- under <project_id>/..., reusing private.storage_event_id for access checks.

create table public.layouts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  venue_id uuid references public.venues (id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  background_path text,
  bg_width integer,
  bg_height integer,
  scale_m_per_px numeric,
  is_template boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id)
);
create index layouts_project_id_idx on public.layouts (project_id);
create index layouts_venue_id_idx on public.layouts (venue_id);
create index layouts_created_by_idx on public.layouts (created_by);
create trigger layouts_updated_at before update on public.layouts
  for each row execute function private.set_updated_at();

create table public.layout_items (
  id uuid primary key default gen_random_uuid(),
  layout_id uuid not null references public.layouts (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null default 'table_round',
  label text not null default '',
  x double precision not null default 0,
  y double precision not null default 0,
  w double precision not null default 48,
  h double precision not null default 48,
  rotation double precision not null default 0,
  color text not null default '#10b981',
  props jsonb not null default '{}'::jsonb,
  sort_order double precision not null default 0,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, layout_id)
);
create index layout_items_layout_id_idx on public.layout_items (layout_id);
create index layout_items_project_id_idx on public.layout_items (project_id);
create index layout_items_created_by_idx on public.layout_items (created_by);
create trigger layout_items_updated_at before update on public.layout_items
  for each row execute function private.set_updated_at();

-- Activity log (same function as the other tables).
create trigger layouts_activity after insert or update or delete on public.layouts
  for each row execute function private.log_activity();
create trigger layout_items_activity after insert or delete on public.layout_items
  for each row execute function private.log_activity();

-- RLS: members read, editors write (mirrors scope_items / features).
alter table public.layouts enable row level security;
alter table public.layout_items enable row level security;

create policy "layouts: members read" on public.layouts
  for select to authenticated using ((select private.is_member(project_id)));
create policy "layouts: editors insert" on public.layouts
  for insert to authenticated with check ((select private.can_edit(project_id)));
create policy "layouts: editors update" on public.layouts
  for update to authenticated
  using ((select private.can_edit(project_id))) with check ((select private.can_edit(project_id)));
create policy "layouts: editors delete" on public.layouts
  for delete to authenticated using ((select private.can_edit(project_id)));

create policy "layout items: members read" on public.layout_items
  for select to authenticated using ((select private.is_member(project_id)));
create policy "layout items: editors insert" on public.layout_items
  for insert to authenticated with check ((select private.can_edit(project_id)));
create policy "layout items: editors update" on public.layout_items
  for update to authenticated
  using ((select private.can_edit(project_id))) with check ((select private.can_edit(project_id)));
create policy "layout items: editors delete" on public.layout_items
  for delete to authenticated using ((select private.can_edit(project_id)));

revoke all on public.layouts, public.layout_items from anon;
grant select, insert, update, delete on public.layouts, public.layout_items to authenticated;

-- Live co-editing.
alter publication supabase_realtime add table public.layouts, public.layout_items;
alter table public.layouts replica identity full;
alter table public.layout_items replica identity full;

-- Private bucket for floor-plan backgrounds, files under <project_id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('layouts', 'layouts', false, 26214400, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "layouts bucket: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'layouts' and (select private.is_member(private.storage_event_id(name))));
create policy "layouts bucket: editors upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'layouts' and (select private.can_edit(private.storage_event_id(name))));
create policy "layouts bucket: editors replace" on storage.objects
  for update to authenticated
  using (bucket_id = 'layouts' and (select private.can_edit(private.storage_event_id(name))))
  with check (bucket_id = 'layouts' and (select private.can_edit(private.storage_event_id(name))));
create policy "layouts bucket: editors delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'layouts' and (select private.can_edit(private.storage_event_id(name))));
