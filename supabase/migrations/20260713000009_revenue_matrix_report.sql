create or replace function public.get_revenue_matrix_report(
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
  v_result jsonb;
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_month not between 1 and 12 then
    raise exception 'INVALID_MONTH';
  end if;

  select a.active_batch_id, b.report_end_month
  into v_batch_id, v_end_month
  from public.active_datasets a
  join public.import_batches b
    on b.id = a.active_batch_id and b.owner_id = a.owner_id
  where a.owner_id = v_owner and a.report_year = p_year;

  if v_batch_id is null then
    raise exception 'ACTIVE_DATASET_NOT_FOUND';
  end if;

  v_selected_month := make_date(p_year, p_month, 1);
  if v_selected_month > v_end_month then
    raise exception 'MONTH_AFTER_ACTIVE_DATASET';
  end if;

  with months as materialized (
    select generate_series(
      make_date(p_year, 1, 1),
      v_selected_month,
      interval '1 month'
    )::date as period_month
  ),
  filtered as materialized (
    select r.section_name, r.period_month, coalesce(r.revenue_amount, 0) as revenue
    from public.revenue_import_rows r
    where r.batch_id = v_batch_id
      and r.owner_id = v_owner
      and r.period_month between make_date(p_year, 1, 1) and v_selected_month
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
  ),
  section_month as (
    select section_name, period_month, sum(revenue) as revenue
    from filtered
    group by section_name, period_month
  ),
  sections as (
    select distinct section_name from filtered
  ),
  report_rows as (
    select
      s.section_name,
      jsonb_object_agg(
        to_char(m.period_month, 'YYYYMM'),
        coalesce(sm.revenue, 0)::text
        order by m.period_month
      ) as monthly_revenue,
      coalesce(sum(sm.revenue), 0) as ytd_revenue
    from sections s
    cross join months m
    left join section_month sm
      on sm.section_name = s.section_name and sm.period_month = m.period_month
    group by s.section_name
  ),
  report_totals as (
    select
      jsonb_object_agg(month_key, revenue::text order by month_key) as monthly_revenue,
      sum(revenue) as ytd_revenue
    from (
      select
        to_char(m.period_month, 'YYYYMM') as month_key,
        coalesce(sum(sm.revenue), 0) as revenue
      from months m
      left join section_month sm on sm.period_month = m.period_month
      group by m.period_month
    ) monthly_totals
  )
  select jsonb_build_object(
    'reportYear', p_year,
    'throughMonth', p_month,
    'months', coalesce(
      (select jsonb_agg(to_char(period_month, 'YYYYMM') order by period_month) from months),
      '[]'::jsonb
    ),
    'rows', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'sectionName', section_name,
            'monthlyRevenue', monthly_revenue,
            'ytdRevenue', ytd_revenue::text
          )
          order by ytd_revenue desc, section_name
        )
        from report_rows
      ),
      '[]'::jsonb
    ),
    'totals', jsonb_build_object(
      'monthlyRevenue', coalesce((select monthly_revenue from report_totals), '{}'::jsonb),
      'ytdRevenue', coalesce((select ytd_revenue from report_totals), 0)::text
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_revenue_matrix_report(integer, integer, jsonb) from public;
grant execute on function public.get_revenue_matrix_report(integer, integer, jsonb) to authenticated;
