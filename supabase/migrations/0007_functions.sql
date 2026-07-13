create or replace function public.filter_allows(
  p_filters jsonb,
  p_key text,
  p_value text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_filters is null or not (p_filters ? p_key) then true
    when jsonb_typeof(p_filters -> p_key) <> 'array' then false
    when jsonb_array_length(p_filters -> p_key) = 0 then true
    else exists (
      select 1 from jsonb_array_elements_text(p_filters -> p_key) item
      where item = p_value
    )
  end;
$$;

create or replace function public.revenue_filters_match(
  p_filters jsonb,
  p_unit_name text,
  p_section_name text,
  p_cost_center text,
  p_business_group text,
  p_service_group text,
  p_product_code text,
  p_service_name text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.filter_allows(p_filters, 'unitNames', p_unit_name)
    and public.filter_allows(p_filters, 'sectionNames', p_section_name)
    and public.filter_allows(p_filters, 'costCenters', p_cost_center)
    and public.filter_allows(p_filters, 'businessGroups', p_business_group)
    and public.filter_allows(p_filters, 'serviceGroups', p_service_group)
    and public.filter_allows(p_filters, 'productCodes', p_product_code)
    and public.filter_allows(p_filters, 'serviceNames', p_service_name);
$$;

create or replace function public.publish_import_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_batch public.import_batches%rowtype;
  v_previous_batch_id uuid;
  v_inserted_count bigint;
  v_published_at timestamptz := now();
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;

  select * into v_batch
  from public.import_batches
  where id = p_batch_id
  for update;

  if not found or v_batch.owner_id <> v_owner then
    raise exception 'BATCH_NOT_OWNED' using errcode = '42501';
  end if;
  if v_batch.status not in ('validated', 'published', 'superseded') then
    raise exception 'BATCH_NOT_PUBLISHABLE';
  end if;
  if coalesce((v_batch.validation_summary ->> 'valid')::boolean, false) is not true then
    raise exception 'BATCH_HAS_VALIDATION_ERRORS';
  end if;

  select count(*) into v_inserted_count
  from public.revenue_import_rows
  where batch_id = p_batch_id and owner_id = v_owner;

  if v_inserted_count <> v_batch.generated_revenue_row_count then
    raise exception 'BATCH_ROW_COUNT_MISMATCH expected %, actual %',
      v_batch.generated_revenue_row_count, v_inserted_count;
  end if;

  select active_batch_id into v_previous_batch_id
  from public.active_datasets
  where owner_id = v_owner and report_year = v_batch.report_year
  for update;

  if v_previous_batch_id is not null and v_previous_batch_id <> p_batch_id then
    update public.import_batches
    set status = 'superseded'
    where id = v_previous_batch_id and owner_id = v_owner;
  end if;

  insert into public.active_datasets(owner_id, report_year, active_batch_id, updated_at)
  values (v_owner, v_batch.report_year, p_batch_id, v_published_at)
  on conflict (owner_id, report_year)
  do update set active_batch_id = excluded.active_batch_id, updated_at = excluded.updated_at;

  update public.import_batches
  set status = 'published', published_at = v_published_at
  where id = p_batch_id;

  return jsonb_build_object(
    'reportYear', v_batch.report_year,
    'previousBatchId', v_previous_batch_id,
    'activeBatchId', p_batch_id,
    'reportEndMonth', v_batch.report_end_month,
    'publishedAt', v_published_at
  );
end;
$$;

create or replace function public.get_available_years()
returns table (
  report_year integer,
  active_batch_id uuid,
  report_end_month date,
  current_month_revenue numeric,
  ytd_revenue numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.report_year, a.active_batch_id, b.report_end_month,
    b.current_month_revenue, b.ytd_revenue
  from public.active_datasets a
  join public.import_batches b on b.id = a.active_batch_id and b.owner_id = a.owner_id
  where a.owner_id = (select auth.uid())
  order by a.report_year desc;
$$;

create or replace function public.get_dimension_options(p_year integer)
returns table (
  unit_name text,
  section_name text,
  cost_center text,
  business_group text,
  service_group text,
  product_code text,
  service_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct r.unit_name, r.section_name, r.cost_center, r.business_group,
    r.service_group, r.product_code, r.service_name
  from public.revenue_import_rows r
  join public.active_datasets a on a.active_batch_id = r.batch_id and a.owner_id = r.owner_id
  where a.owner_id = (select auth.uid()) and a.report_year = p_year
  order by r.unit_name, r.section_name, r.business_group, r.service_group, r.service_name;
$$;

create or replace function public.get_dashboard_kpis(
  p_year integer,
  p_month integer,
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_batch_id uuid;
  v_end_month date;
  v_selected_month date;
  v_previous_month date;
  v_selected numeric := 0;
  v_ytd numeric := 0;
  v_previous numeric;
  v_mom numeric;
  v_mom_percent numeric;
  v_active_count bigint := 0;
  v_negative_count bigint := 0;
  v_negative_amount numeric := 0;
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_month not between 1 and 12 then raise exception 'INVALID_MONTH'; end if;

  select a.active_batch_id, b.report_end_month into v_batch_id, v_end_month
  from public.active_datasets a
  join public.import_batches b on b.id = a.active_batch_id and b.owner_id = a.owner_id
  where a.owner_id = v_owner and a.report_year = p_year;
  if v_batch_id is null then raise exception 'ACTIVE_DATASET_NOT_FOUND'; end if;

  v_selected_month := make_date(p_year, p_month, 1);
  if v_selected_month > v_end_month then raise exception 'MONTH_AFTER_ACTIVE_DATASET'; end if;
  v_previous_month := case when p_month = 1 then null else v_selected_month - interval '1 month' end;

  select
    coalesce(sum(coalesce(r.revenue_amount, 0)) filter (where r.period_month = v_selected_month), 0),
    coalesce(sum(coalesce(r.revenue_amount, 0)) filter (where r.period_month between make_date(p_year, 1, 1) and v_selected_month), 0),
    sum(coalesce(r.revenue_amount, 0)) filter (where r.period_month = v_previous_month),
    count(distinct r.record_key) filter (where r.period_month = v_selected_month and r.revenue_amount is not null and r.revenue_amount <> 0),
    count(*) filter (where r.period_month = v_selected_month and r.revenue_amount < 0),
    coalesce(sum(r.revenue_amount) filter (where r.period_month = v_selected_month and r.revenue_amount < 0), 0)
  into v_selected, v_ytd, v_previous, v_active_count, v_negative_count, v_negative_amount
  from public.revenue_import_rows r
  where r.batch_id = v_batch_id and r.owner_id = v_owner
    and public.revenue_filters_match(p_filters, r.unit_name, r.section_name, r.cost_center,
      r.business_group, r.service_group, r.product_code, r.service_name);

  v_mom := case when v_previous is null then null else v_selected - v_previous end;
  v_mom_percent := case when v_previous is null or v_previous = 0 then null
    else (v_selected - v_previous) / abs(v_previous) * 100 end;

  return jsonb_build_object(
    'selectedMonthRevenue', v_selected::text,
    'ytdRevenue', v_ytd::text,
    'previousMonthRevenue', case when v_previous is null then null else to_jsonb(v_previous::text) end,
    'momAmount', case when v_mom is null then null else to_jsonb(v_mom::text) end,
    'momPercent', case when v_mom_percent is null then null else to_jsonb(v_mom_percent::text) end,
    'activeServiceCount', v_active_count,
    'negativeRecordCount', v_negative_count,
    'negativeRevenueAmount', v_negative_amount::text
  );
end;
$$;

create or replace function public.get_monthly_trend(
  p_year integer,
  p_month integer,
  p_filters jsonb default '{}'::jsonb
)
returns table(period_month date, revenue numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_batch_id uuid;
  v_end_month date;
  v_selected_month date;
begin
  if p_month not between 1 and 12 then raise exception 'INVALID_MONTH'; end if;
  select a.active_batch_id, b.report_end_month into v_batch_id, v_end_month
  from public.active_datasets a join public.import_batches b on b.id = a.active_batch_id
  where a.owner_id = v_owner and a.report_year = p_year and b.owner_id = v_owner;
  if v_batch_id is null then raise exception 'ACTIVE_DATASET_NOT_FOUND'; end if;
  v_selected_month := make_date(p_year, p_month, 1);
  if v_selected_month > v_end_month then raise exception 'MONTH_AFTER_ACTIVE_DATASET'; end if;

  return query
  with months as (
    select generate_series(make_date(p_year, 1, 1), v_selected_month, interval '1 month')::date as month
  ), totals as (
    select r.period_month, sum(coalesce(r.revenue_amount, 0)) as amount
    from public.revenue_import_rows r
    where r.batch_id = v_batch_id and r.owner_id = v_owner
      and r.period_month <= v_selected_month
      and public.revenue_filters_match(p_filters, r.unit_name, r.section_name, r.cost_center,
        r.business_group, r.service_group, r.product_code, r.service_name)
    group by r.period_month
  )
  select months.month, coalesce(totals.amount, 0)
  from months left join totals on totals.period_month = months.month
  order by months.month;
end;
$$;

create or replace function public.get_grouped_revenue(
  p_year integer,
  p_month integer,
  p_group_by text,
  p_filters jsonb default '{}'::jsonb,
  p_limit integer default 20
)
returns table (
  group_key text,
  group_label text,
  selected_month_revenue numeric,
  ytd_revenue numeric,
  previous_month_revenue numeric,
  mom_amount numeric,
  mom_percent numeric,
  share_percent numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_batch_id uuid;
  v_selected_month date := make_date(p_year, p_month, 1);
  v_previous_month date := case when p_month = 1 then null else make_date(p_year, p_month, 1) - interval '1 month' end;
begin
  if p_group_by not in ('unit_name', 'section_name', 'business_group', 'service_group', 'service_name') then
    raise exception 'INVALID_GROUP_BY';
  end if;
  select active_batch_id into v_batch_id from public.active_datasets
  where owner_id = v_owner and report_year = p_year;
  if v_batch_id is null then raise exception 'ACTIVE_DATASET_NOT_FOUND'; end if;

  return query
  with filtered as (
    select r.*,
      case p_group_by
        when 'unit_name' then r.unit_name when 'section_name' then r.section_name
        when 'business_group' then r.business_group when 'service_group' then r.service_group
        when 'service_name' then r.service_name
      end as label
    from public.revenue_import_rows r
    where r.batch_id = v_batch_id and r.owner_id = v_owner
      and r.period_month <= v_selected_month
      and public.revenue_filters_match(p_filters, r.unit_name, r.section_name, r.cost_center,
        r.business_group, r.service_group, r.product_code, r.service_name)
  ), grouped as (
    select label,
      coalesce(sum(coalesce(revenue_amount, 0)) filter (where period_month = v_selected_month), 0) as selected_amount,
      coalesce(sum(coalesce(revenue_amount, 0)) filter (where period_month between make_date(p_year, 1, 1) and v_selected_month), 0) as ytd_amount,
      sum(coalesce(revenue_amount, 0)) filter (where period_month = v_previous_month) as previous_amount
    from filtered group by label
  ), calculated as (
    select *, sum(selected_amount) over () as selected_total from grouped
  )
  select label, label, selected_amount, ytd_amount, previous_amount,
    case when previous_amount is null then null else selected_amount - previous_amount end,
    case when previous_amount is null or previous_amount = 0 then null
      else (selected_amount - previous_amount) / abs(previous_amount) * 100 end,
    case when selected_total = 0 then null else selected_amount / selected_total * 100 end
  from calculated
  order by selected_amount desc, label
  limit least(greatest(p_limit, 1), 100);
end;
$$;

create or replace function public.get_explorer_rows(
  p_year integer,
  p_month integer,
  p_level text,
  p_filters jsonb default '{}'::jsonb,
  p_search text default null,
  p_sort_by text default 'selected_month_revenue',
  p_sort_direction text default 'desc',
  p_page integer default 1,
  p_page_size integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_batch_id uuid;
  v_selected_month date := make_date(p_year, p_month, 1);
  v_previous_month date := case when p_month = 1 then null else make_date(p_year, p_month, 1) - interval '1 month' end;
  v_page integer := greatest(p_page, 1);
  v_page_size integer := least(greatest(p_page_size, 1), 100);
  v_result jsonb;
begin
  if p_level not in ('unit', 'section', 'business_group', 'service_group', 'service') then raise exception 'INVALID_LEVEL'; end if;
  if p_sort_by not in ('label', 'selected_month_revenue', 'ytd_revenue', 'previous_month_revenue', 'mom_amount', 'mom_percent') then raise exception 'INVALID_SORT'; end if;
  if p_sort_direction not in ('asc', 'desc') then raise exception 'INVALID_SORT_DIRECTION'; end if;
  select active_batch_id into v_batch_id from public.active_datasets where owner_id = v_owner and report_year = p_year;
  if v_batch_id is null then raise exception 'ACTIVE_DATASET_NOT_FOUND'; end if;

  with raw as (
    select r.*,
      case p_level
        when 'unit' then r.unit_name when 'section' then r.section_name
        when 'business_group' then r.business_group when 'service_group' then r.service_group
        when 'service' then r.record_key
      end as group_id,
      case p_level
        when 'unit' then r.unit_name when 'section' then r.section_name
        when 'business_group' then r.business_group when 'service_group' then r.service_group
        when 'service' then r.service_name
      end as label
    from public.revenue_import_rows r
    where r.batch_id = v_batch_id and r.owner_id = v_owner and r.period_month <= v_selected_month
      and public.revenue_filters_match(p_filters, r.unit_name, r.section_name, r.cost_center,
        r.business_group, r.service_group, r.product_code, r.service_name)
  ), grouped as (
    select group_id, label, min(unit_name) as unit_name, min(section_name) as section_name,
      min(cost_center) as cost_center, min(business_group) as business_group,
      min(service_group) as service_group, min(product_code) as product_code,
      min(service_name) as service_name,
      coalesce(sum(coalesce(revenue_amount, 0)) filter (where period_month = v_selected_month), 0) as selected_amount,
      coalesce(sum(coalesce(revenue_amount, 0)) filter (where period_month between make_date(p_year, 1, 1) and v_selected_month), 0) as ytd_amount,
      sum(coalesce(revenue_amount, 0)) filter (where period_month = v_previous_month) as previous_amount
    from raw group by group_id, label
  ), calculated as (
    select *, selected_amount - previous_amount as mom_amount,
      case when previous_amount is null or previous_amount = 0 then null
        else (selected_amount - previous_amount) / abs(previous_amount) * 100 end as mom_percent,
      case when sum(selected_amount) over () = 0 then null
        else selected_amount / sum(selected_amount) over () * 100 end as share_percent
    from grouped
  ), searched as (
    select * from calculated where p_search is null or label ilike '%' || p_search || '%'
  ), ordered as (
    select *, row_number() over (order by
      case when p_sort_by = 'label' and p_sort_direction = 'asc' then label end asc,
      case when p_sort_by = 'label' and p_sort_direction = 'desc' then label end desc,
      case when p_sort_by = 'selected_month_revenue' and p_sort_direction = 'asc' then selected_amount end asc,
      case when p_sort_by = 'selected_month_revenue' and p_sort_direction = 'desc' then selected_amount end desc,
      case when p_sort_by = 'ytd_revenue' and p_sort_direction = 'asc' then ytd_amount end asc,
      case when p_sort_by = 'ytd_revenue' and p_sort_direction = 'desc' then ytd_amount end desc,
      case when p_sort_by = 'previous_month_revenue' and p_sort_direction = 'asc' then previous_amount end asc nulls last,
      case when p_sort_by = 'previous_month_revenue' and p_sort_direction = 'desc' then previous_amount end desc nulls last,
      case when p_sort_by = 'mom_amount' and p_sort_direction = 'asc' then mom_amount end asc nulls last,
      case when p_sort_by = 'mom_amount' and p_sort_direction = 'desc' then mom_amount end desc nulls last,
      case when p_sort_by = 'mom_percent' and p_sort_direction = 'asc' then mom_percent end asc nulls last,
      case when p_sort_by = 'mom_percent' and p_sort_direction = 'desc' then mom_percent end desc nulls last,
      label asc
    ) as item_order
    from searched
  ), paged as (
    select * from ordered
    where item_order > (v_page - 1) * v_page_size and item_order <= v_page * v_page_size
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'key', group_id, 'label', label, 'unitName', unit_name, 'sectionName', section_name,
      'costCenter', cost_center, 'businessGroup', business_group, 'serviceGroup', service_group,
      'productCode', product_code, 'serviceName', service_name,
      'selectedMonthRevenue', selected_amount::text, 'ytdRevenue', ytd_amount::text,
      'previousMonthRevenue', case when previous_amount is null then null else to_jsonb(previous_amount::text) end,
      'momAmount', case when mom_amount is null then null else to_jsonb(mom_amount::text) end,
      'momPercent', case when mom_percent is null then null else to_jsonb(mom_percent::text) end,
      'sharePercent', case when share_percent is null then null else to_jsonb(share_percent::text) end,
      'drillFilters', case p_level
        when 'unit' then jsonb_build_object('unitNames', jsonb_build_array(unit_name))
        when 'section' then jsonb_build_object('unitNames', jsonb_build_array(unit_name), 'sectionNames', jsonb_build_array(section_name))
        when 'business_group' then jsonb_build_object('businessGroups', jsonb_build_array(business_group))
        when 'service_group' then jsonb_build_object('serviceGroups', jsonb_build_array(service_group))
        else jsonb_build_object('productCodes', jsonb_build_array(product_code), 'serviceNames', jsonb_build_array(service_name))
      end
    ) order by item_order) from paged), '[]'::jsonb),
    'page', v_page,
    'pageSize', v_page_size,
    'totalItems', (select count(*) from searched),
    'totalPages', ceil((select count(*) from searched)::numeric / v_page_size)::integer
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.get_export_rows(
  p_year integer,
  p_month integer,
  p_filters jsonb default '{}'::jsonb,
  p_offset integer default 0,
  p_limit integer default 1000
)
returns setof public.revenue_import_rows
language sql
stable
security definer
set search_path = ''
as $$
  select r.*
  from public.revenue_import_rows r
  join public.active_datasets a on a.active_batch_id = r.batch_id and a.owner_id = r.owner_id
  where a.owner_id = (select auth.uid()) and a.report_year = p_year
    and r.period_month between make_date(p_year, 1, 1) and make_date(p_year, p_month, 1)
    and public.revenue_filters_match(p_filters, r.unit_name, r.section_name, r.cost_center,
      r.business_group, r.service_group, r.product_code, r.service_name)
  order by r.period_month, r.source_row_number
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 1000);
$$;

create or replace function public.delete_unpublished_import(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_batch public.import_batches%rowtype;
begin
  select * into v_batch from public.import_batches where id = p_batch_id for update;
  if not found or v_batch.owner_id <> v_owner then raise exception 'BATCH_NOT_OWNED' using errcode = '42501'; end if;
  if v_batch.status not in ('uploading', 'validated', 'failed') then raise exception 'BATCH_CANNOT_BE_DELETED'; end if;
  delete from public.import_batches where id = p_batch_id;
  return jsonb_build_object('deletedBatchId', p_batch_id, 'storagePath', v_batch.storage_path);
end;
$$;

revoke all on function public.filter_allows(jsonb, text, text) from public;
revoke all on function public.revenue_filters_match(jsonb, text, text, text, text, text, text, text) from public;
revoke all on function public.publish_import_batch(uuid) from public;
revoke all on function public.get_available_years() from public;
revoke all on function public.get_dimension_options(integer) from public;
revoke all on function public.get_dashboard_kpis(integer, integer, jsonb) from public;
revoke all on function public.get_monthly_trend(integer, integer, jsonb) from public;
revoke all on function public.get_grouped_revenue(integer, integer, text, jsonb, integer) from public;
revoke all on function public.get_explorer_rows(integer, integer, text, jsonb, text, text, text, integer, integer) from public;
revoke all on function public.get_export_rows(integer, integer, jsonb, integer, integer) from public;
revoke all on function public.delete_unpublished_import(uuid) from public;

grant execute on function public.publish_import_batch(uuid) to authenticated;
grant execute on function public.get_available_years() to authenticated;
grant execute on function public.get_dimension_options(integer) to authenticated;
grant execute on function public.get_dashboard_kpis(integer, integer, jsonb) to authenticated;
grant execute on function public.get_monthly_trend(integer, integer, jsonb) to authenticated;
grant execute on function public.get_grouped_revenue(integer, integer, text, jsonb, integer) to authenticated;
grant execute on function public.get_explorer_rows(integer, integer, text, jsonb, text, text, text, integer, integer) to authenticated;
grant execute on function public.get_export_rows(integer, integer, jsonb, integer, integer) to authenticated;
grant execute on function public.delete_unpublished_import(uuid) to authenticated;
