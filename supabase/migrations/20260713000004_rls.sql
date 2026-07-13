alter table public.import_batches enable row level security;
alter table public.revenue_import_rows enable row level security;
alter table public.active_datasets enable row level security;

create policy import_batches_select_own on public.import_batches
for select to authenticated using (owner_id = (select auth.uid()));

create policy import_batches_insert_own on public.import_batches
for insert to authenticated with check (owner_id = (select auth.uid()));

create policy import_batches_update_own on public.import_batches
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy import_batches_delete_unpublished on public.import_batches
for delete to authenticated
using (owner_id = (select auth.uid()) and status in ('uploading', 'validated', 'failed'));

create policy revenue_rows_select_own on public.revenue_import_rows
for select to authenticated using (owner_id = (select auth.uid()));

create policy revenue_rows_insert_uploading on public.revenue_import_rows
for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.import_batches b
    where b.id = batch_id and b.owner_id = (select auth.uid()) and b.status = 'uploading'
  )
);

create policy revenue_rows_delete_unpublished on public.revenue_import_rows
for delete to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.import_batches b
    where b.id = batch_id and b.owner_id = (select auth.uid())
      and b.status in ('uploading', 'validated', 'failed')
  )
);

create policy active_datasets_select_own on public.active_datasets
for select to authenticated using (owner_id = (select auth.uid()));

revoke all on public.import_batches, public.revenue_import_rows, public.active_datasets from anon;
grant select, insert, update, delete on public.import_batches to authenticated;
grant select, insert, delete on public.revenue_import_rows to authenticated;
grant select on public.active_datasets to authenticated;
grant usage, select on sequence public.revenue_import_rows_id_seq to authenticated;
