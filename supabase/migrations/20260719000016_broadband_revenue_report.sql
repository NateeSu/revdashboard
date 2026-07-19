create index if not exists revenue_import_rows_broadband_report_idx
on public.revenue_import_rows(batch_id, business_group, service_group, unit_name, section_name);

create or replace function public.get_broadband_revenue_report(p_year integer)
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
  v_through_month integer;
  v_has_comparable_previous boolean;
  v_result jsonb;
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_year is null or p_year not between 2000 and 2200 then
    raise exception 'INVALID_REPORT_YEAR';
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

  v_through_month := extract(month from v_current_end)::integer;
  v_has_comparable_previous := v_previous_batch is not null
    and extract(month from v_previous_end)::integer >= v_through_month;

  with
  report_items(
    sort_order,
    parent_key,
    item_key,
    item_level,
    unit_name,
    section_name,
    display_label
  ) as (
    values
      (10, 'department:op1', 'section:chanthaburi', 'section', 'อป.1',
        'ส่วนขายและบริการลูกค้า จันทบุรี', 'จันทบุรี'),
      (11, 'department:op1', 'section:trat', 'section', 'อป.1',
        'ส่วนขายและบริการลูกค้า ตราด', 'ตราด'),
      (12, 'department:op1', 'section:nakhon-nayok', 'section', 'อป.1',
        'ส่วนขายและบริการลูกค้า นครนายก', 'นครนายก'),
      (13, 'department:op1', 'section:prachinburi', 'section', 'อป.1',
        'ส่วนขายและบริการลูกค้า ปราจีนบุรี', 'ปราจีนบุรี'),
      (14, 'department:op1', 'section:sa-kaeo', 'section', 'อป.1',
        'ส่วนขายและบริการลูกค้า สระแก้ว', 'สระแก้ว'),
      (15, 'group:op', 'department:op1', 'department', 'อป.1', null::text, 'อป.1'),
      (20, 'department:op2', 'section:chachoengsao', 'section', 'อป.2',
        'ส่วนขายและบริการลูกค้า ฉะเชิงเทรา', 'ฉะเชิงเทรา'),
      (21, 'department:op2', 'section:laem-chabang', 'section', 'อป.2',
        'ส่วนขายและบริการลูกค้า แหลมฉบัง', 'แหลมฉบัง'),
      (22, 'department:op2', 'section:chonburi', 'section', 'อป.2',
        'ส่วนขายและบริการลูกค้า ชลบุรี', 'ชลบุรี'),
      (23, 'department:op2', 'section:pattaya', 'section', 'อป.2',
        'ส่วนขายและบริการลูกค้า เมืองพัทยา', 'เมืองพัทยา'),
      (24, 'department:op2', 'section:map-ta-phut', 'section', 'อป.2',
        'ส่วนขายและบริการลูกค้า มาบตาพุด', 'มาบตาพุด'),
      (25, 'department:op2', 'section:rayong', 'section', 'อป.2',
        'ส่วนขายและบริการลูกค้า ระยอง', 'ระยอง'),
      (26, 'group:op', 'department:op2', 'department', 'อป.2', null::text, 'อป.2'),
      (30, null::text, 'group:op', 'group', null::text, null::text, 'อป.')
  ),
  current_rows as materialized (
    select
      r.unit_name,
      r.section_name,
      coalesce(r.revenue_amount, 0) as amount
    from public.revenue_import_rows r
    join public.organization_group_units gu
      on gu.unit_name = r.unit_name and gu.group_code = 'อป.'
    where r.owner_id = v_owner
      and r.batch_id = v_current_batch
      and r.business_group = '4.Fixed Line & Broadband'
      and r.service_group = '4.2.กลุ่มบริการ Internet Retail'
      and r.period_month between make_date(p_year, 1, 1) and v_current_end
  ),
  previous_rows as materialized (
    select
      r.unit_name,
      r.section_name,
      coalesce(r.revenue_amount, 0) as amount
    from public.revenue_import_rows r
    join public.organization_group_units gu
      on gu.unit_name = r.unit_name and gu.group_code = 'อป.'
    where v_has_comparable_previous
      and r.owner_id = v_owner
      and r.batch_id = v_previous_batch
      and r.business_group = '4.Fixed Line & Broadband'
      and r.service_group = '4.2.กลุ่มบริการ Internet Retail'
      and r.period_month between make_date(p_year - 1, 1, 1)
        and make_date(p_year - 1, v_through_month, 1)
  ),
  current_section_totals as (
    select unit_name, section_name, sum(amount) as revenue
    from current_rows
    group by unit_name, section_name
  ),
  current_unit_totals as (
    select unit_name, sum(amount) as revenue
    from current_rows
    group by unit_name
  ),
  current_group_total as (
    select coalesce(sum(amount), 0) as revenue from current_rows
  ),
  previous_section_totals as (
    select unit_name, section_name, sum(amount) as revenue
    from previous_rows
    group by unit_name, section_name
  ),
  previous_unit_totals as (
    select unit_name, sum(amount) as revenue
    from previous_rows
    group by unit_name
  ),
  previous_group_total as (
    select coalesce(sum(amount), 0) as revenue from previous_rows
  ),
  matching_targets as materialized (
    select t.*
    from public.revenue_targets t
    where t.owner_id = v_owner
      and t.target_year = p_year
      and t.service_level = 'service_group'
      and t.business_group = '4.Fixed Line & Broadband'
      and t.service_group = '4.2.กลุ่มบริการ Internet Retail'
      and (
        (t.organization_level = 'group' and t.group_code = 'อป.')
        or (t.organization_level = 'unit' and t.unit_name in ('อป.1', 'อป.2'))
        or (t.organization_level = 'section' and t.unit_name in ('อป.1', 'อป.2'))
      )
  ),
  row_values as (
    select
      i.*,
      coalesce(
        case i.item_level
          when 'section' then cs.revenue
          when 'department' then cu.revenue
          else cg.revenue
        end,
        0
      ) as current_ytd_revenue,
      case
        when not v_has_comparable_previous then null
        else coalesce(
          case i.item_level
            when 'section' then ps.revenue
            when 'department' then pu.revenue
            else pg.revenue
          end,
          0
        )
      end as previous_comparison_revenue,
      t.target_amount as annual_target
    from report_items i
    left join current_section_totals cs
      on i.item_level = 'section'
      and cs.unit_name = i.unit_name
      and cs.section_name = i.section_name
    left join current_unit_totals cu
      on i.item_level = 'department' and cu.unit_name = i.unit_name
    left join current_group_total cg on i.item_level = 'group'
    left join previous_section_totals ps
      on i.item_level = 'section'
      and ps.unit_name = i.unit_name
      and ps.section_name = i.section_name
    left join previous_unit_totals pu
      on i.item_level = 'department' and pu.unit_name = i.unit_name
    left join previous_group_total pg on i.item_level = 'group'
    left join matching_targets t on
      (i.item_level = 'group'
        and t.organization_level = 'group'
        and t.group_code = 'อป.')
      or (i.item_level = 'department'
        and t.organization_level = 'unit'
        and t.unit_name = i.unit_name)
      or (i.item_level = 'section'
        and t.organization_level = 'section'
        and t.unit_name = i.unit_name
        and t.section_name = i.section_name)
  ),
  row_metrics as (
    select
      r.*,
      case
        when r.previous_comparison_revenue is null then null
        else r.current_ytd_revenue - r.previous_comparison_revenue
      end as difference,
      case
        when r.previous_comparison_revenue is null or r.previous_comparison_revenue = 0 then null
        else (r.current_ytd_revenue - r.previous_comparison_revenue)
          / abs(r.previous_comparison_revenue) * 100
      end as difference_percent,
      case when r.annual_target is null then null
        else r.annual_target * v_through_month / 12 end as expected_target,
      case when r.annual_target is null then null
        else r.current_ytd_revenue / r.annual_target * 100 end as annual_target_percent,
      case when r.annual_target is null then null
        else r.current_ytd_revenue / (r.annual_target * v_through_month / 12) * 100
      end as expected_target_percent,
      case when r.annual_target is null then null
        else r.current_ytd_revenue - (r.annual_target * v_through_month / 12)
      end as expected_target_variance
    from row_values r
  ),
  target_stats as (
    select
      count(annual_target)::integer as configured_target_count,
      count(*)::integer as required_target_count
    from row_metrics
  )
  select jsonb_build_object(
    'reportYear', p_year,
    'previousYear', p_year - 1,
    'throughMonth', v_through_month,
    'hasPreviousYear', v_previous_batch is not null,
    'hasComparablePreviousYear', v_has_comparable_previous,
    'organization', jsonb_build_object(
      'groupCode', 'อป.',
      'groupName', 'ภาคตะวันออก',
      'label', 'อป. — ภาคตะวันออก'
    ),
    'service', jsonb_build_object(
      'businessGroup', '4.Fixed Line & Broadband',
      'serviceGroup', '4.2.กลุ่มบริการ Internet Retail',
      'label', 'Internet Retail (Broadband)'
    ),
    'targetPacePercent', round(v_through_month::numeric / 12 * 100, 2)::text,
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', item_key,
          'sortOrder', sort_order,
          'parentKey', parent_key,
          'level', item_level,
          'unitName', unit_name,
          'sectionName', section_name,
          'label', display_label,
          'currentYtdRevenueBaht', current_ytd_revenue::numeric(20,2)::text,
          'previousComparisonRevenueBaht', case
            when previous_comparison_revenue is null then null
            else previous_comparison_revenue::numeric(20,2)::text end,
          'differenceBaht', case when difference is null then null
            else difference::numeric(20,2)::text end,
          'differencePercent', case when difference_percent is null then null
            else round(difference_percent, 2)::text end,
          'annualTargetBaht', case when annual_target is null then null
            else annual_target::numeric(20,2)::text end,
          'expectedTargetBaht', case when expected_target is null then null
            else expected_target::numeric(20,2)::text end,
          'annualTargetPercent', case when annual_target_percent is null then null
            else round(annual_target_percent, 2)::text end,
          'expectedTargetPercent', case when expected_target_percent is null then null
            else round(expected_target_percent, 2)::text end,
          'expectedTargetVarianceBaht', case when expected_target_variance is null then null
            else expected_target_variance::numeric(20,2)::text end,
          'targetConfigured', annual_target is not null
        ) order by sort_order
      )
      from row_metrics
    ), '[]'::jsonb),
    'totals', (
      select jsonb_build_object(
        'currentYtdRevenueBaht', r.current_ytd_revenue::numeric(20,2)::text,
        'previousComparisonRevenueBaht', case
          when r.previous_comparison_revenue is null then null
          else r.previous_comparison_revenue::numeric(20,2)::text end,
        'differenceBaht', case when r.difference is null then null
          else r.difference::numeric(20,2)::text end,
        'differencePercent', case when r.difference_percent is null then null
          else round(r.difference_percent, 2)::text end,
        'annualTargetBaht', case when r.annual_target is null then null
          else r.annual_target::numeric(20,2)::text end,
        'expectedTargetBaht', case when r.expected_target is null then null
          else r.expected_target::numeric(20,2)::text end,
        'annualTargetPercent', case when r.annual_target_percent is null then null
          else round(r.annual_target_percent, 2)::text end,
        'expectedTargetPercent', case when r.expected_target_percent is null then null
          else round(r.expected_target_percent, 2)::text end,
        'expectedTargetVarianceBaht', case when r.expected_target_variance is null then null
          else r.expected_target_variance::numeric(20,2)::text end,
        'configuredTargetCount', s.configured_target_count,
        'requiredTargetCount', s.required_target_count,
        'hasAllTargets', s.configured_target_count = s.required_target_count
      )
      from row_metrics r
      cross join target_stats s
      where r.item_level = 'group'
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_broadband_revenue_report(integer) from public;
grant execute on function public.get_broadband_revenue_report(integer) to authenticated;
