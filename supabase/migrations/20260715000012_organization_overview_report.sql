create or replace function public.get_organization_overview_report(p_year integer)
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
  v_current_comparison_end date;
  v_previous_comparison_end date;
  v_result jsonb;
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select a.active_batch_id, b.report_end_month
  into v_current_batch, v_current_end
  from public.active_datasets a
  join public.import_batches b
    on b.id = a.active_batch_id and b.owner_id = a.owner_id
  where a.owner_id = v_owner and a.report_year = p_year;

  if v_current_batch is null then
    raise exception 'ACTIVE_DATASET_NOT_FOUND';
  end if;

  select a.active_batch_id, b.report_end_month
  into v_previous_batch, v_previous_end
  from public.active_datasets a
  join public.import_batches b
    on b.id = a.active_batch_id and b.owner_id = a.owner_id
  where a.owner_id = v_owner and a.report_year = p_year - 1;

  v_comparison_month := case
    when v_previous_batch is null then extract(month from v_current_end)::integer
    else least(
      extract(month from v_current_end)::integer,
      extract(month from v_previous_end)::integer
    )
  end;
  v_current_comparison_end := make_date(p_year, v_comparison_month, 1);
  v_previous_comparison_end := make_date(p_year - 1, v_comparison_month, 1);

  with group_mapping(group_code, group_name, sort_order, unit_name) as (
    values
      ('นป.'::text, 'ภาคเหนือ'::text, 1, 'นป.1'::text),
      ('นป.'::text, 'ภาคเหนือ'::text, 1, 'นป.2'::text),
      ('ตป.'::text, 'ภาคตะวันออกเฉียงเหนือ'::text, 2, 'ตป.1'::text),
      ('ตป.'::text, 'ภาคตะวันออกเฉียงเหนือ'::text, 2, 'ตป.2'::text),
      ('อป.'::text, 'ภาคตะวันออก'::text, 3, 'อป.1'::text),
      ('อป.'::text, 'ภาคตะวันออก'::text, 3, 'อป.2'::text)
  ),
  groups as (
    select group_code, group_name, min(sort_order) as sort_order
    from group_mapping
    group by group_code, group_name
  ),
  current_rows as materialized (
    select
      r.unit_name,
      r.section_name,
      r.period_month,
      coalesce(r.revenue_amount, 0) as amount
    from public.revenue_import_rows r
    where r.owner_id = v_owner
      and r.batch_id = v_current_batch
      and r.period_month between make_date(p_year, 1, 1) and v_current_end
  ),
  previous_rows as materialized (
    select
      r.unit_name,
      r.section_name,
      r.period_month,
      coalesce(r.revenue_amount, 0) as amount
    from public.revenue_import_rows r
    where v_previous_batch is not null
      and r.owner_id = v_owner
      and r.batch_id = v_previous_batch
      and r.period_month between make_date(p_year - 1, 1, 1) and v_previous_comparison_end
  ),
  current_group_totals as (
    select
      m.group_code,
      sum(r.amount) as current_ytd_revenue,
      coalesce(sum(r.amount) filter (
        where r.period_month <= v_current_comparison_end
      ), 0) as current_comparison_revenue
    from group_mapping m
    join current_rows r on r.unit_name = m.unit_name
    group by m.group_code
  ),
  previous_group_totals as (
    select m.group_code, sum(r.amount) as previous_comparison_revenue
    from group_mapping m
    join previous_rows r on r.unit_name = m.unit_name
    group by m.group_code
  ),
  section_totals as (
    select
      m.group_code,
      r.unit_name,
      r.section_name,
      sum(r.amount) as revenue
    from group_mapping m
    join current_rows r on r.unit_name = m.unit_name
    group by m.group_code, r.unit_name, r.section_name
  ),
  ranked_sections as (
    select
      *,
      row_number() over (
        partition by group_code
        order by revenue desc, section_name, unit_name
      ) as rank
    from section_totals
  ),
  top_sections as (
    select
      group_code,
      jsonb_agg(
        jsonb_build_object(
          'rank', rank,
          'unitName', unit_name,
          'sectionName', section_name,
          'revenue', revenue::text
        )
        order by rank
      ) filter (where rank <= 3) as rows
    from ranked_sections
    group by group_code
  ),
  current_total as (
    select coalesce(sum(amount), 0) as revenue from current_rows
  ),
  mapped_total as (
    select coalesce(sum(r.amount), 0) as revenue
    from current_rows r
    where exists (
      select 1 from group_mapping m where m.unit_name = r.unit_name
    )
  ),
  unmapped as (
    select
      coalesce(sum(r.amount), 0) as revenue,
      count(distinct r.section_name)::integer as section_count,
      coalesce(
        jsonb_agg(distinct r.unit_name) filter (where r.unit_name is not null),
        '[]'::jsonb
      ) as unit_names
    from current_rows r
    where not exists (
      select 1 from group_mapping m where m.unit_name = r.unit_name
    )
  ),
  report_groups as (
    select
      g.group_code,
      g.group_name,
      g.sort_order,
      coalesce(c.current_ytd_revenue, 0) as current_ytd_revenue,
      coalesce(c.current_comparison_revenue, 0) as current_comparison_revenue,
      coalesce(p.previous_comparison_revenue, 0) as previous_comparison_revenue,
      coalesce(c.current_comparison_revenue, 0)
        - coalesce(p.previous_comparison_revenue, 0) as difference,
      case
        when v_previous_batch is null or coalesce(p.previous_comparison_revenue, 0) = 0 then null
        else (
          coalesce(c.current_comparison_revenue, 0)
            - coalesce(p.previous_comparison_revenue, 0)
        ) / abs(p.previous_comparison_revenue) * 100
      end as difference_percent,
      case
        when (select revenue from current_total) = 0 then null
        else coalesce(c.current_ytd_revenue, 0)
          / abs((select revenue from current_total)) * 100
      end as share_percent,
      coalesce(t.rows, '[]'::jsonb) as top_sections
    from groups g
    left join current_group_totals c on c.group_code = g.group_code
    left join previous_group_totals p on p.group_code = g.group_code
    left join top_sections t on t.group_code = g.group_code
  )
  select jsonb_build_object(
    'reportYear', p_year,
    'previousYear', p_year - 1,
    'throughMonth', extract(month from v_current_end)::integer,
    'comparisonThroughMonth', v_comparison_month,
    'hasPreviousYear', v_previous_batch is not null,
    'totalYtdRevenue', (select revenue::text from current_total),
    'mappedYtdRevenue', (select revenue::text from mapped_total),
    'groups', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'code', group_code,
          'name', group_name,
          'label', group_code || ' — ' || group_name,
          'currentYtdRevenue', current_ytd_revenue::text,
          'sharePercent', case when share_percent is null then null
            else to_jsonb(share_percent::text) end,
          'currentComparisonRevenue', current_comparison_revenue::text,
          'previousComparisonRevenue', previous_comparison_revenue::text,
          'difference', difference::text,
          'differencePercent', case when difference_percent is null then null
            else to_jsonb(difference_percent::text) end,
          'topSections', top_sections
        )
        order by sort_order
      )
      from report_groups
    ), '[]'::jsonb),
    'unmapped', jsonb_build_object(
      'currentYtdRevenue', (select revenue::text from unmapped),
      'sharePercent', case
        when (select revenue from current_total) = 0 then null
        else to_jsonb(((select revenue from unmapped)
          / abs((select revenue from current_total)) * 100)::text)
      end,
      'sectionCount', (select section_count from unmapped),
      'unitNames', (select unit_names from unmapped)
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_organization_overview_report(integer) from public;
grant execute on function public.get_organization_overview_report(integer) to authenticated;
