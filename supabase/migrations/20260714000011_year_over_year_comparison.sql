create or replace function public.get_year_over_year_comparison(
  p_year integer,
  p_month integer,
  p_level text default 'section',
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid := (select public.current_data_owner_id());
  v_current_batch uuid;
  v_previous_batch uuid;
  v_current_end date;
  v_previous_end date;
  v_comparison_month integer;
  v_current_month date;
  v_previous_month date;
  v_result jsonb;
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_month not between 1 and 12 then
    raise exception 'INVALID_MONTH';
  end if;
  if p_level not in ('section', 'service') then
    raise exception 'INVALID_COMPARISON_LEVEL';
  end if;

  select a.active_batch_id, b.report_end_month
  into v_current_batch, v_current_end
  from public.active_datasets a
  join public.import_batches b on b.id = a.active_batch_id and b.owner_id = a.owner_id
  where a.owner_id = v_owner and a.report_year = p_year;

  select a.active_batch_id, b.report_end_month
  into v_previous_batch, v_previous_end
  from public.active_datasets a
  join public.import_batches b on b.id = a.active_batch_id and b.owner_id = a.owner_id
  where a.owner_id = v_owner and a.report_year = p_year - 1;

  if v_current_batch is null then
    raise exception 'ACTIVE_DATASET_NOT_FOUND';
  end if;
  if v_previous_batch is null then
    raise exception 'PREVIOUS_YEAR_DATASET_NOT_FOUND';
  end if;

  v_comparison_month := least(
    p_month,
    extract(month from v_current_end)::integer,
    extract(month from v_previous_end)::integer
  );
  v_current_month := make_date(p_year, v_comparison_month, 1);
  v_previous_month := make_date(p_year - 1, v_comparison_month, 1);

  with scoped as (
    select
      'current'::text as dataset,
      case p_level
        when 'section' then jsonb_build_array(r.unit_name, r.section_name)::text
        else jsonb_build_array(r.unit_name, r.section_name, r.product_code, r.service_name)::text
      end as comparison_key,
      r.period_month,
      r.unit_name,
      r.section_name,
      r.product_code,
      r.service_name,
      coalesce(r.revenue_amount, 0) as amount
    from public.revenue_import_rows r
    where r.batch_id = v_current_batch
      and r.owner_id = v_owner
      and r.period_month between make_date(p_year, 1, 1) and v_current_month
      and public.revenue_filters_match(
        p_filters,
        r.unit_name,
        r.section_name,
        r.cost_center,
        r.business_group,
        r.service_group,
        r.product_code,
        r.service_name
      )

    union all

    select
      'previous'::text as dataset,
      case p_level
        when 'section' then jsonb_build_array(r.unit_name, r.section_name)::text
        else jsonb_build_array(r.unit_name, r.section_name, r.product_code, r.service_name)::text
      end as comparison_key,
      r.period_month,
      r.unit_name,
      r.section_name,
      r.product_code,
      r.service_name,
      coalesce(r.revenue_amount, 0) as amount
    from public.revenue_import_rows r
    where r.batch_id = v_previous_batch
      and r.owner_id = v_owner
      and r.period_month between make_date(p_year - 1, 1, 1) and v_previous_month
      and public.revenue_filters_match(
        p_filters,
        r.unit_name,
        r.section_name,
        r.cost_center,
        r.business_group,
        r.service_group,
        r.product_code,
        r.service_name
      )
  ), grouped as (
    select
      comparison_key,
      min(unit_name) as unit_name,
      min(section_name) as section_name,
      min(product_code) as product_code,
      min(service_name) as service_name,
      count(*) filter (where dataset = 'current') > 0 as has_current,
      count(*) filter (where dataset = 'previous') > 0 as has_previous,
      coalesce(sum(amount) filter (
        where dataset = 'current' and period_month = v_current_month
      ), 0) as current_month_revenue,
      coalesce(sum(amount) filter (
        where dataset = 'previous' and period_month = v_previous_month
      ), 0) as previous_month_revenue,
      coalesce(sum(amount) filter (where dataset = 'current'), 0) as current_ytd_revenue,
      coalesce(sum(amount) filter (where dataset = 'previous'), 0) as previous_ytd_revenue
    from scoped
    group by comparison_key
  ), calculated as (
    select
      *,
      current_month_revenue - previous_month_revenue as month_change,
      case when previous_month_revenue = 0 then null
        else (current_month_revenue - previous_month_revenue)
          / abs(previous_month_revenue) * 100 end as month_change_percent,
      current_ytd_revenue - previous_ytd_revenue as ytd_change,
      case when previous_ytd_revenue = 0 then null
        else (current_ytd_revenue - previous_ytd_revenue)
          / abs(previous_ytd_revenue) * 100 end as ytd_change_percent
    from grouped
  ), month_numbers as (
    select generate_series(1, v_comparison_month) as month_number
  ), monthly as (
    select
      month_numbers.month_number,
      coalesce(sum(scoped.amount) filter (
        where scoped.dataset = 'current'
          and extract(month from scoped.period_month)::integer = month_numbers.month_number
      ), 0) as current_revenue,
      coalesce(sum(scoped.amount) filter (
        where scoped.dataset = 'previous'
          and extract(month from scoped.period_month)::integer = month_numbers.month_number
      ), 0) as previous_revenue
    from month_numbers
    left join scoped on extract(month from scoped.period_month)::integer = month_numbers.month_number
    group by month_numbers.month_number
    order by month_numbers.month_number
  )
  select jsonb_build_object(
    'currentYear', p_year,
    'previousYear', p_year - 1,
    'requestedMonth', p_month,
    'comparisonThroughMonth', v_comparison_month,
    'level', p_level,
    'monthlyTrend', coalesce((
      select jsonb_agg(jsonb_build_object(
        'month', month_number,
        'currentRevenue', current_revenue::text,
        'previousRevenue', previous_revenue::text,
        'change', (current_revenue - previous_revenue)::text,
        'changePercent', case when previous_revenue = 0 then null
          else to_jsonb(((current_revenue - previous_revenue) / abs(previous_revenue) * 100)::text)
        end
      ) order by month_number)
      from monthly
    ), '[]'::jsonb),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', comparison_key,
        'unitName', unit_name,
        'sectionName', section_name,
        'productCode', case when p_level = 'service' then product_code else null end,
        'serviceName', case when p_level = 'service' then service_name else null end,
        'matchStatus', case
          when has_current and has_previous then 'both'
          when has_current then 'current_only'
          else 'previous_only'
        end,
        'currentMonthRevenue', current_month_revenue::text,
        'previousMonthRevenue', previous_month_revenue::text,
        'monthChange', month_change::text,
        'monthChangePercent', case when month_change_percent is null then null
          else to_jsonb(month_change_percent::text) end,
        'currentYtdRevenue', current_ytd_revenue::text,
        'previousYtdRevenue', previous_ytd_revenue::text,
        'ytdChange', ytd_change::text,
        'ytdChangePercent', case when ytd_change_percent is null then null
          else to_jsonb(ytd_change_percent::text) end
      ) order by current_ytd_revenue desc, section_name, service_name)
      from calculated
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_year_over_year_comparison(integer, integer, text, jsonb)
from public;
grant execute on function public.get_year_over_year_comparison(integer, integer, text, jsonb)
to authenticated;
