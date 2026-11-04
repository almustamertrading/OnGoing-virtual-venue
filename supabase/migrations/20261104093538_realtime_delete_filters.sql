-- Realtime can only filter DELETE events (by venue_id) when the old row is logged in full.
alter table public.features replica identity full;
alter table public.layers replica identity full;
alter table public.comments replica identity full;
alter table public.panoramas replica identity full;
alter table public.venues replica identity full;
