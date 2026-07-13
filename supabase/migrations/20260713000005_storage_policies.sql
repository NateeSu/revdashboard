insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'source-files',
  'source-files',
  false,
  10485760,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update set public = false;

create policy source_files_insert_own on storage.objects
for insert to authenticated
with check (bucket_id = 'source-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy source_files_select_own on storage.objects
for select to authenticated
using (bucket_id = 'source-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy source_files_delete_unpublished on storage.objects
for delete to authenticated
using (
  bucket_id = 'source-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.import_batches b
    where b.id::text = (storage.foldername(name))[3]
      and b.owner_id = (select auth.uid())
      and b.status in ('uploading', 'validated', 'failed')
  )
);
