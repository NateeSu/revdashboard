create or replace function public.get_op_service_overview_report(p_year integer)
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
    business_group,
    service_group,
    display_label
  ) as (
    values
      (10, null::text, 'business:hard-infrastructure', 'business_group',
        '1.Hard Infrastructure', null::text, '1. Hard Infrastructure'),
      (11, 'business:hard-infrastructure', 'service:asset-development', 'service_group',
        '1.Hard Infrastructure', '1.4.กลุ่มบริการพัฒนาสินทรัพย์',
        '1.4 กลุ่มบริการพัฒนาสินทรัพย์'),
      (20, null::text, 'business:international', 'business_group',
        '2.International', null::text, '2. International'),
      (30, null::text, 'business:mobile', 'business_group',
        '3.Mobile', null::text, '3. Mobile'),
      (31, 'business:mobile', 'service:mobile-retail', 'service_group',
        '3.Mobile', '3.2.บริการโทรคมนาคมสื่อสารไร้สาย - กลุ่มค้าปลีก (Retail)',
        '3.2 กลุ่มบริการโทรคมนาคมสื่อสารไร้สาย - กลุ่มค้าปลีก (Retail)'),
      (32, 'business:mobile', 'service:trunk-radio', 'service_group',
        '3.Mobile', '3.3.บริการ Trunk Radio', '3.3 กลุ่มบริการ Trunk Radio'),
      (40, null::text, 'business:fixed-line-broadband', 'business_group',
        '4.Fixed Line & Broadband', null::text, '4. Fixed Line & Broadband'),
      (41, 'business:fixed-line-broadband', 'service:internet-retail', 'service_group',
        '4.Fixed Line & Broadband', '4.2.กลุ่มบริการ Internet Retail',
        '4.1 กลุ่มบริการ Internet Retail'),
      (42, 'business:fixed-line-broadband', 'service:datacom', 'service_group',
        '4.Fixed Line & Broadband', '4.3.กลุ่มบริการวงจรเช่า (Datacom)',
        '4.2 กลุ่มบริการวงจรเช่า (Datacom)'),
      (43, 'business:fixed-line-broadband', 'service:fixed-line', 'service_group',
        '4.Fixed Line & Broadband', '4.4.บริการโทรศัพท์ประจำที่ (Fixed Line)',
        '4.3 กลุ่มบริการโทรศัพท์ประจำที่ (Fixed Line)'),
      (50, null::text, 'business:digital', 'business_group',
        '5.Digital', null::text, '5. Digital'),
      (60, null::text, 'business:ict-solution', 'business_group',
        '6.ICT Solution', null::text, '6. ICT Solution')
  ),
  current_rows as materialized (
    select
      r.business_group,
      r.service_group,
      coalesce(r.revenue_amount, 0) as amount
    from public.revenue_import_rows r
    join public.organization_group_units gu
      on gu.unit_name = r.unit_name and gu.group_code = 'อป.'
    where r.owner_id = v_owner
      and r.batch_id = v_current_batch
      and r.period_month between make_date(p_year, 1, 1) and v_current_end
  ),
  previous_rows as materialized (
    select
      r.business_group,
      r.service_group,
      coalesce(r.revenue_amount, 0) as amount
    from public.revenue_import_rows r
    join public.organization_group_units gu
      on gu.unit_name = r.unit_name and gu.group_code = 'อป.'
    where v_has_comparable_previous
      and r.owner_id = v_owner
      and r.batch_id = v_previous_batch
      and r.period_month between make_date(p_year - 1, 1, 1)
        and make_date(p_year - 1, v_through_month, 1)
  ),
  current_business_totals as (
    select business_group, sum(amount) as revenue
    from current_rows
    group by business_group
  ),
  current_service_totals as (
    select business_group, service_group, sum(amount) as revenue
    from current_rows
    group by business_group, service_group
  ),
  previous_business_totals as (
    select business_group, sum(amount) as revenue
    from previous_rows
    group by business_group
  ),
  previous_service_totals as (
    select business_group, service_group, sum(amount) as revenue
    from previous_rows
    group by business_group, service_group
  ),
  matching_targets as materialized (
    select t.*
    from public.revenue_targets t
    where t.owner_id = v_owner
      and t.target_year = p_year
      and t.organization_level = 'group'
      and t.group_code = 'อป.'
      and t.service_level in ('business_group', 'service_group')
  ),
  row_values as (
    select
      i.*,
      coalesce(
        case
          when i.item_level = 'business_group' then cb.revenue
          else cs.revenue
        end,
        0
      ) as current_ytd_revenue,
      case
        when not v_has_comparable_previous then null
        else coalesce(
          case
            when i.item_level = 'business_group' then pb.revenue
            else ps.revenue
          end,
          0
        )
      end as previous_comparison_revenue,
      t.target_amount as annual_target
    from report_items i
    left join current_business_totals cb
      on i.item_level = 'business_group' and cb.business_group = i.business_group
    left join current_service_totals cs
      on i.item_level = 'service_group'
      and cs.business_group = i.business_group
      and cs.service_group = i.service_group
    left join previous_business_totals pb
      on i.item_level = 'business_group' and pb.business_group = i.business_group
    left join previous_service_totals ps
      on i.item_level = 'service_group'
      and ps.business_group = i.business_group
      and ps.service_group = i.service_group
    left join matching_targets t
      on (
        i.item_level = 'business_group'
        and t.service_level = 'business_group'
        and t.business_group = i.business_group
      ) or (
        i.item_level = 'service_group'
        and t.service_level = 'service_group'
        and t.business_group = i.business_group
        and t.service_group = i.service_group
      )
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
      case
        when r.annual_target is null then null
        else r.annual_target * v_through_month / 12
      end as expected_target,
      case
        when r.annual_target is null then null
        else r.current_ytd_revenue / r.annual_target * 100
      end as annual_target_percent,
      case
        when r.annual_target is null then null
        else r.current_ytd_revenue / (r.annual_target * v_through_month / 12) * 100
      end as expected_target_percent,
      case
        when r.annual_target is null then null
        else r.current_ytd_revenue - (r.annual_target * v_through_month / 12)
      end as expected_target_variance
    from row_values r
  ),
  total_values as (
    select
      coalesce(sum(current_ytd_revenue), 0) as current_ytd_revenue,
      case when v_has_comparable_previous
        then coalesce(sum(previous_comparison_revenue), 0)
        else null
      end as previous_comparison_revenue,
      count(annual_target)::integer as configured_target_count,
      count(*)::integer as required_target_count,
      case when count(annual_target) = 0 then null else sum(annual_target) end as annual_target
    from row_metrics
    where item_level = 'business_group'
  ),
  total_metrics as (
    select
      t.*,
      case
        when t.previous_comparison_revenue is null then null
        else t.current_ytd_revenue - t.previous_comparison_revenue
      end as difference,
      case
        when t.previous_comparison_revenue is null or t.previous_comparison_revenue = 0 then null
        else (t.current_ytd_revenue - t.previous_comparison_revenue)
          / abs(t.previous_comparison_revenue) * 100
      end as difference_percent,
      case
        when t.annual_target is null then null
        else t.annual_target * v_through_month / 12
      end as expected_target,
      case
        when t.annual_target is null then null
        else t.current_ytd_revenue / t.annual_target * 100
      end as annual_target_percent,
      case
        when t.annual_target is null then null
        else t.current_ytd_revenue / (t.annual_target * v_through_month / 12) * 100
      end as expected_target_percent,
      case
        when t.annual_target is null then null
        else t.current_ytd_revenue - (t.annual_target * v_through_month / 12)
      end as expected_target_variance
    from total_values t
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
    'targetPacePercent', round(v_through_month::numeric / 12 * 100, 2)::text,
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', item_key,
          'sortOrder', sort_order,
          'parentKey', parent_key,
          'level', item_level,
          'businessGroup', business_group,
          'serviceGroup', service_group,
          'label', display_label,
          'currentYtdRevenueBaht', current_ytd_revenue::numeric(20,2)::text,
          'previousComparisonRevenueBaht', case
            when previous_comparison_revenue is null then null
            else previous_comparison_revenue::numeric(20,2)::text
          end,
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
        'currentYtdRevenueBaht', current_ytd_revenue::numeric(20,2)::text,
        'previousComparisonRevenueBaht', case
          when previous_comparison_revenue is null then null
          else previous_comparison_revenue::numeric(20,2)::text
        end,
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
        'configuredTargetCount', configured_target_count,
        'requiredTargetCount', required_target_count,
        'hasAllBusinessGroupTargets', configured_target_count = required_target_count
      )
      from total_metrics
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_op_service_overview_report(integer) from public;
grant execute on function public.get_op_service_overview_report(integer) to authenticated;
