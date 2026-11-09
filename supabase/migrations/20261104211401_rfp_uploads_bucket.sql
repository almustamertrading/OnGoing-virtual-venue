-- Private bucket for temporary RFP PDF uploads.
-- The browser uploads the PDF straight here (bypassing the serverless request-size
-- limit), the server action downloads it to send to Claude, then deletes it.
-- Files live under <user_id>/..., and each person can only touch their own uploads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rfp-uploads', 'rfp-uploads', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;

create policy "rfp-uploads: owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rfp-uploads'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "rfp-uploads: owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'rfp-uploads'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "rfp-uploads: owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'rfp-uploads'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
