create or replace function public.current_data_owner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then null
    when coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', 'owner') = 'viewer'
      then nullif((select auth.jwt()) -> 'app_metadata' ->> 'data_owner_id', '')::uuid
    else (select auth.uid())
  end;
$$;

create or replace function public.current_user_can_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', 'owner') <> 'viewer';
$$;

revoke all on function public.current_data_owner_id() from public;
revoke all on function public.current_user_can_write() from public;
grant execute on function public.current_data_owner_id() to authenticated;
grant execute on function public.current_user_can_write() to authenticated;

drop policy if exists import_batches_select_own on public.import_batches;
drop policy if exists import_batches_select_permitted on public.import_batches;
create policy import_batches_select_permitted on public.import_batches
for select to authenticated using (owner_id = (select public.current_data_owner_id()));

drop policy if exists import_batches_insert_own on public.import_batches;
create policy import_batches_insert_own on public.import_batches
for insert to authenticated with check (
  (select public.current_user_can_write()) and owner_id = (select auth.uid())
);

drop policy if exists import_batches_update_own on public.import_batches;
create policy import_batches_update_own on public.import_batches
for update to authenticated
using ((select public.current_user_can_write()) and owner_id = (select auth.uid()))
with check ((select public.current_user_can_write()) and owner_id = (select auth.uid()));

drop policy if exists import_batches_delete_unpublished on public.import_batches;
create policy import_batches_delete_unpublished on public.import_batches
for delete to authenticated using (
  (select public.current_user_can_write())
  and owner_id = (select auth.uid())
  and status in ('uploading', 'validated', 'failed')
);

drop policy if exists revenue_rows_select_own on public.revenue_import_rows;
drop policy if exists revenue_rows_select_permitted on public.revenue_import_rows;
create policy revenue_rows_select_permitted on public.revenue_import_rows
for select to authenticated using (owner_id = (select public.current_data_owner_id()));

drop policy if exists revenue_rows_insert_uploading on public.revenue_import_rows;
create policy revenue_rows_insert_uploading on public.revenue_import_rows
for insert to authenticated with check (
  (select public.current_user_can_write())
  and owner_id = (select auth.uid())
  and exists (
    select 1 from public.import_batches b
    where b.id = batch_id and b.owner_id = (select auth.uid()) and b.status = 'uploading'
  )
);

drop policy if exists revenue_rows_delete_unpublished on public.revenue_import_rows;
create policy revenue_rows_delete_unpublished on public.revenue_import_rows
for delete to authenticated using (
  (select public.current_user_can_write())
  and owner_id = (select auth.uid())
  and exists (
    select 1 from public.import_batches b
    where b.id = batch_id and b.owner_id = (select auth.uid())
      and b.status in ('uploading', 'validated', 'failed')
  )
);

drop policy if exists active_datasets_select_own on public.active_datasets;
drop policy if exists active_datasets_select_permitted on public.active_datasets;
create policy active_datasets_select_permitted on public.active_datasets
for select to authenticated using (owner_id = (select public.current_data_owner_id()));

drop policy if exists source_files_insert_own on storage.objects;
create policy source_files_insert_own on storage.objects
for insert to authenticated with check (
  (select public.current_user_can_write())
  and bucket_id = 'source-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists source_files_delete_unpublished on storage.objects;
create policy source_files_delete_unpublished on storage.objects
for delete to authenticated using (
  (select public.current_user_can_write())
  and bucket_id = 'source-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.import_batches b
    where b.id::text = (storage.foldername(name))[3]
      and b.owner_id = (select auth.uid())
      and b.status in ('uploading', 'validated', 'failed')
  )
);

do $$
declare
  v_function record;
  v_definition text;
  v_updated text;
begin
  for v_function in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(array[
        'get_available_years',
        'get_dimension_options',
        'get_dashboard_kpis',
        'get_monthly_trend',
        'get_grouped_revenue',
        'get_explorer_rows',
        'get_export_rows',
        'get_revenue_matrix_report'
      ])
  loop
    v_definition := pg_get_functiondef(v_function.oid);
    v_updated := regexp_replace(
      v_definition,
      '\(\s*select\s+auth\.uid\(\)\s*\)',
      '(select public.current_data_owner_id())',
      'gi'
    );

    if v_updated = v_definition and position('current_data_owner_id' in v_definition) = 0 then
      raise exception 'AUTH_UID_REFERENCE_NOT_FOUND: %', v_function.proname;
    end if;

    if v_updated <> v_definition then
      execute v_updated;
    end if;
  end loop;
end;
$$;

do $$
declare
  v_function record;
  v_definition text;
  v_updated text;
begin
  for v_function in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(array['publish_import_batch', 'delete_unpublished_import'])
  loop
    v_definition := pg_get_functiondef(v_function.oid);
    v_updated := regexp_replace(
      v_definition,
      'v_owner\s+uuid\s*:=\s*\(\s*select\s+auth\.uid\(\)\s*\)',
      'v_owner uuid := case when (select public.current_user_can_write()) then (select auth.uid()) else null end',
      'i'
    );

    if v_updated = v_definition and position('current_user_can_write' in v_definition) = 0 then
      raise exception 'WRITE_GUARD_REFERENCE_NOT_FOUND: %', v_function.proname;
    end if;

    if v_updated <> v_definition then
      execute v_updated;
    end if;
  end loop;
end;
$$;
