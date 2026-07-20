alter table public.revenue_targets
  add column if not exists service_name text;

alter table public.revenue_targets
  drop constraint if exists revenue_targets_service_level_check,
  drop constraint if exists revenue_targets_service_scope_valid,
  drop constraint if exists revenue_targets_scope_unique;

alter table public.revenue_targets
  add constraint revenue_targets_service_level_check
    check (service_level in ('all', 'business_group', 'service_group', 'service')),
  add constraint revenue_targets_service_scope_valid check (
    (service_level = 'all'
      and business_group is null and service_group is null and service_name is null)
    or
    (service_level = 'business_group'
      and business_group is not null and length(btrim(business_group)) > 0
      and service_group is null and service_name is null)
    or
    (service_level = 'service_group'
      and business_group is not null and length(btrim(business_group)) > 0
      and service_group is not null and length(btrim(service_group)) > 0
      and service_name is null)
    or
    (service_level = 'service'
      and business_group is not null and length(btrim(business_group)) > 0
      and service_group is not null and length(btrim(service_group)) > 0
      and service_name is not null and length(btrim(service_name)) > 0)
  ),
  add constraint revenue_targets_scope_unique unique nulls not distinct (
    owner_id,
    target_year,
    organization_level,
    group_code,
    unit_name,
    section_name,
    service_level,
    business_group,
    service_group,
    service_name
  );

create index if not exists revenue_import_rows_op_service_report_idx
on public.revenue_import_rows(
  owner_id,
  batch_id,
  business_group,
  service_group,
  service_name,
  unit_name,
  section_name,
  period_month
);

create or replace function public.save_revenue_target(
  p_target_id uuid,
  p_target_year integer,
  p_organization_level text,
  p_group_code text,
  p_unit_name text,
  p_section_name text,
  p_service_level text,
  p_business_group text,
  p_service_group text,
  p_service_name text,
  p_target_amount_text text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := case
    when (select public.current_user_can_write()) then (select auth.uid())
    else null
  end;
  v_target_id uuid;
  v_option_batch uuid;
  v_organization_level text := lower(nullif(btrim(p_organization_level), ''));
  v_group_code text;
  v_unit_name text;
  v_section_name text;
  v_service_level text := lower(nullif(btrim(p_service_level), ''));
  v_business_group text;
  v_service_group text;
  v_service_name text;
  v_target_amount numeric(20,2);
begin
  if v_owner is null then
    raise exception 'WRITE_ACCESS_REQUIRED' using errcode = '42501';
  end if;

  if p_target_year is null or p_target_year not between 2000 and 2200 then
    raise exception 'INVALID_TARGET_YEAR';
  end if;

  begin
    v_target_amount := nullif(btrim(p_target_amount_text), '')::numeric(20,2);
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'INVALID_TARGET_AMOUNT';
  end;

  if v_target_amount is null or v_target_amount <= 0 then
    raise exception 'TARGET_AMOUNT_MUST_BE_POSITIVE';
  end if;

  if v_organization_level is null or v_organization_level not in ('group', 'unit', 'section') then
    raise exception 'INVALID_ORGANIZATION_LEVEL';
  end if;

  if v_service_level is null
    or v_service_level not in ('all', 'business_group', 'service_group', 'service') then
    raise exception 'INVALID_SERVICE_LEVEL';
  end if;

  v_group_code := case
    when v_organization_level = 'group' then nullif(btrim(p_group_code), '') else null end;
  v_unit_name := case
    when v_organization_level in ('unit', 'section') then nullif(btrim(p_unit_name), '')
    else null end;
  v_section_name := case
    when v_organization_level = 'section' then nullif(btrim(p_section_name), '') else null end;
  v_business_group := case
    when v_service_level in ('business_group', 'service_group', 'service')
      then nullif(btrim(p_business_group), '') else null end;
  v_service_group := case
    when v_service_level in ('service_group', 'service')
      then nullif(btrim(p_service_group), '') else null end;
  v_service_name := case
    when v_service_level = 'service' then nullif(btrim(p_service_name), '') else null end;

  if v_organization_level = 'group' and v_group_code is null then
    raise exception 'GROUP_REQUIRED';
  end if;
  if v_organization_level in ('unit', 'section') and v_unit_name is null then
    raise exception 'UNIT_REQUIRED';
  end if;
  if v_organization_level = 'section' and v_section_name is null then
    raise exception 'SECTION_REQUIRED';
  end if;
  if v_service_level in ('business_group', 'service_group', 'service')
    and v_business_group is null then
    raise exception 'BUSINESS_GROUP_REQUIRED';
  end if;
  if v_service_level in ('service_group', 'service') and v_service_group is null then
    raise exception 'SERVICE_GROUP_REQUIRED';
  end if;
  if v_service_level = 'service' and v_service_name is null then
    raise exception 'SERVICE_REQUIRED';
  end if;

  select a.active_batch_id
  into v_option_batch
  from public.active_datasets a
  where a.owner_id = v_owner
  order by (a.report_year = p_target_year) desc, a.report_year desc
  limit 1;

  if v_organization_level = 'group' and not exists (
    select 1 from public.organization_groups g where g.group_code = v_group_code
  ) then
    raise exception 'GROUP_NOT_FOUND';
  end if;

  if v_organization_level = 'unit' and (
    v_option_batch is null or not exists (
      select 1 from public.revenue_import_rows r
      where r.owner_id = v_owner and r.batch_id = v_option_batch and r.unit_name = v_unit_name
    )
  ) and not exists (
    select 1 from public.revenue_targets t
    where t.id = p_target_id and t.owner_id = v_owner
      and t.organization_level = 'unit' and t.unit_name = v_unit_name
  ) then
    raise exception 'UNIT_NOT_FOUND';
  end if;

  if v_organization_level = 'section' and (
    v_option_batch is null or not exists (
      select 1 from public.revenue_import_rows r
      where r.owner_id = v_owner and r.batch_id = v_option_batch
        and r.unit_name = v_unit_name and r.section_name = v_section_name
    )
  ) and not exists (
    select 1 from public.revenue_targets t
    where t.id = p_target_id and t.owner_id = v_owner
      and t.organization_level = 'section'
      and t.unit_name = v_unit_name and t.section_name = v_section_name
  ) then
    raise exception 'SECTION_NOT_FOUND';
  end if;

  if v_service_level = 'business_group' and (
    v_option_batch is null or not exists (
      select 1 from public.revenue_import_rows r
      where r.owner_id = v_owner and r.batch_id = v_option_batch
        and r.business_group = v_business_group
    )
  ) and not exists (
    select 1 from public.revenue_targets t
    where t.id = p_target_id and t.owner_id = v_owner
      and t.service_level = 'business_group' and t.business_group = v_business_group
  ) then
    raise exception 'BUSINESS_GROUP_NOT_FOUND';
  end if;

  if v_service_level = 'service_group' and (
    v_option_batch is null or not exists (
      select 1 from public.revenue_import_rows r
      where r.owner_id = v_owner and r.batch_id = v_option_batch
        and r.business_group = v_business_group and r.service_group = v_service_group
    )
  ) and not exists (
    select 1 from public.revenue_targets t
    where t.id = p_target_id and t.owner_id = v_owner
      and t.service_level = 'service_group'
      and t.business_group = v_business_group and t.service_group = v_service_group
  ) then
    raise exception 'SERVICE_GROUP_NOT_FOUND';
  end if;

  if v_service_level = 'service' and (
    v_option_batch is null or not exists (
      select 1 from public.revenue_import_rows r
      where r.owner_id = v_owner and r.batch_id = v_option_batch
        and r.business_group = v_business_group and r.service_group = v_service_group
        and r.service_name = v_service_name
    )
  ) and not exists (
    select 1 from public.revenue_targets t
    where t.id = p_target_id and t.owner_id = v_owner
      and t.service_level = 'service' and t.business_group = v_business_group
      and t.service_group = v_service_group and t.service_name = v_service_name
  ) then
    raise exception 'SERVICE_NOT_FOUND';
  end if;

  if p_target_id is null then
    insert into public.revenue_targets (
      owner_id, target_year, organization_level, group_code, unit_name, section_name,
      service_level, business_group, service_group, service_name, target_amount
    ) values (
      v_owner, p_target_year, v_organization_level, v_group_code, v_unit_name, v_section_name,
      v_service_level, v_business_group, v_service_group, v_service_name, v_target_amount
    )
    on conflict on constraint revenue_targets_scope_unique
    do update set target_amount = excluded.target_amount
    returning id into v_target_id;
  else
    update public.revenue_targets
    set target_year = p_target_year,
        organization_level = v_organization_level,
        group_code = v_group_code,
        unit_name = v_unit_name,
        section_name = v_section_name,
        service_level = v_service_level,
        business_group = v_business_group,
        service_group = v_service_group,
        service_name = v_service_name,
        target_amount = v_target_amount
    where id = p_target_id and owner_id = v_owner
    returning id into v_target_id;

    if v_target_id is null then
      raise exception 'TARGET_NOT_FOUND';
    end if;
  end if;

  return jsonb_build_object('id', v_target_id, 'targetAmountBaht', v_target_amount::text);
exception
  when unique_violation then
    raise exception 'TARGET_SCOPE_ALREADY_EXISTS';
end;
$$;

create or replace function public.get_revenue_target_setup(p_year integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid := (select public.current_data_owner_id());
  v_current_year integer := extract(year from timezone('Asia/Bangkok', now()))::integer;
  v_data_batch uuid;
  v_data_end date;
  v_option_batch uuid;
  v_option_year integer;
  v_result jsonb;
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_year is null or p_year not between 2000 and 2200 then
    raise exception 'INVALID_TARGET_YEAR';
  end if;

  select a.active_batch_id, b.report_end_month
  into v_data_batch, v_data_end
  from public.active_datasets a
  join public.import_batches b on b.id = a.active_batch_id and b.owner_id = a.owner_id
  where a.owner_id = v_owner and a.report_year = p_year;

  select a.active_batch_id, a.report_year
  into v_option_batch, v_option_year
  from public.active_datasets a
  where a.owner_id = v_owner
  order by (a.report_year = p_year) desc, a.report_year desc
  limit 1;

  with
  years as (
    select a.report_year from public.active_datasets a where a.owner_id = v_owner
    union
    select t.target_year from public.revenue_targets t where t.owner_id = v_owner
    union select p_year
    union select v_current_year
    union select v_current_year + 1
  ),
  option_rows as materialized (
    select r.unit_name, r.section_name, r.business_group, r.service_group, r.service_name
    from public.revenue_import_rows r
    where r.owner_id = v_owner and r.batch_id = v_option_batch
  ),
  target_progress as (
    select
      t.*,
      case when v_data_batch is null then null else coalesce(sum(r.revenue_amount), 0) end
        as actual_amount
    from public.revenue_targets t
    left join public.revenue_import_rows r
      on v_data_batch is not null
      and r.owner_id = v_owner
      and r.batch_id = v_data_batch
      and r.period_month between make_date(p_year, 1, 1) and v_data_end
      and (
        (t.organization_level = 'group' and exists (
          select 1 from public.organization_group_units gu
          where gu.group_code = t.group_code and gu.unit_name = r.unit_name
        ))
        or (t.organization_level = 'unit' and r.unit_name = t.unit_name)
        or (t.organization_level = 'section'
          and r.unit_name = t.unit_name and r.section_name = t.section_name)
      )
      and (
        t.service_level = 'all'
        or (t.service_level = 'business_group' and r.business_group = t.business_group)
        or (t.service_level = 'service_group'
          and r.business_group = t.business_group and r.service_group = t.service_group)
        or (t.service_level = 'service'
          and r.business_group = t.business_group and r.service_group = t.service_group
          and r.service_name = t.service_name)
      )
    where t.owner_id = v_owner and t.target_year = p_year
    group by t.id
  )
  select jsonb_build_object(
    'targetYear', p_year,
    'hasYearData', v_data_batch is not null,
    'throughMonth', case when v_data_end is null then null
      else extract(month from v_data_end)::integer end,
    'optionsSourceYear', v_option_year,
    'yearOptions', coalesce((
      select jsonb_agg(y.report_year order by y.report_year desc) from years y
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', g.group_code,
        'name', g.group_name,
        'label', g.group_code || ' — ' || g.group_name
      ) order by g.sort_order)
      from public.organization_groups g
    ), '[]'::jsonb),
    'units', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', u.unit_name,
        'groupCode', gu.group_code
      ) order by coalesce(g.sort_order, 999), u.unit_name)
      from (select distinct o.unit_name from option_rows o) u
      left join public.organization_group_units gu on gu.unit_name = u.unit_name
      left join public.organization_groups g on g.group_code = gu.group_code
    ), '[]'::jsonb),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'unitName', s.unit_name,
        'name', s.section_name
      ) order by s.unit_name, s.section_name)
      from (select distinct o.unit_name, o.section_name from option_rows o) s
    ), '[]'::jsonb),
    'businessGroups', coalesce((
      select jsonb_agg(b.business_group order by b.business_group)
      from (select distinct o.business_group from option_rows o) b
    ), '[]'::jsonb),
    'serviceGroups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'businessGroup', s.business_group,
        'name', s.service_group
      ) order by s.business_group, s.service_group)
      from (select distinct o.business_group, o.service_group from option_rows o) s
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'businessGroup', s.business_group,
        'serviceGroup', s.service_group,
        'name', s.service_name
      ) order by s.business_group, s.service_group, s.service_name)
      from (
        select distinct o.business_group, o.service_group, o.service_name from option_rows o
      ) s
    ), '[]'::jsonb),
    'targets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'targetYear', t.target_year,
        'organizationLevel', t.organization_level,
        'groupCode', t.group_code,
        'unitName', t.unit_name,
        'sectionName', t.section_name,
        'organizationLabel', case
          when t.organization_level = 'group' then
            t.group_code || coalesce(' — ' || g.group_name, '')
          when t.organization_level = 'unit' then 'ฝ่าย ' || t.unit_name
          else t.section_name || ' · ฝ่าย ' || t.unit_name
        end,
        'serviceLevel', t.service_level,
        'businessGroup', t.business_group,
        'serviceGroup', t.service_group,
        'serviceName', t.service_name,
        'serviceLabel', case
          when t.service_level = 'all' then 'ทุกบริการ'
          when t.service_level = 'business_group' then 'กลุ่มธุรกิจ ' || t.business_group
          when t.service_level = 'service_group' then
            'กลุ่มบริการ ' || t.service_group || ' · ' || t.business_group
          else t.service_name || ' · ' || t.service_group
        end,
        'targetAmountBaht', t.target_amount::text,
        'targetAmountMillion', (t.target_amount / 1000000)::numeric(20,2)::text,
        'actualRevenueBaht', case when t.actual_amount is null then null
          else t.actual_amount::numeric(20,2)::text end,
        'remainingAmountBaht', case when t.actual_amount is null then null
          else (t.target_amount - t.actual_amount)::numeric(20,2)::text end,
        'achievementPercent', case when t.actual_amount is null then null
          else round((t.actual_amount / t.target_amount) * 100, 2)::text end,
        'dimensionAvailable', (
          case t.organization_level
            when 'group' then exists (
              select 1 from public.organization_groups og where og.group_code = t.group_code
            )
            when 'unit' then exists (
              select 1 from option_rows o where o.unit_name = t.unit_name
            )
            else exists (
              select 1 from option_rows o
              where o.unit_name = t.unit_name and o.section_name = t.section_name
            )
          end
          and
          case t.service_level
            when 'all' then true
            when 'business_group' then exists (
              select 1 from option_rows o where o.business_group = t.business_group
            )
            when 'service_group' then exists (
              select 1 from option_rows o
              where o.business_group = t.business_group and o.service_group = t.service_group
            )
            else exists (
              select 1 from option_rows o
              where o.business_group = t.business_group and o.service_group = t.service_group
                and o.service_name = t.service_name
            )
          end
        ),
        'createdAt', t.created_at,
        'updatedAt', t.updated_at
      ) order by t.updated_at desc, t.created_at desc)
      from target_progress t
      left join public.organization_groups g on g.group_code = t.group_code
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.save_revenue_target(
  p_target_id uuid,
  p_target_year integer,
  p_organization_level text,
  p_group_code text,
  p_unit_name text,
  p_section_name text,
  p_service_level text,
  p_business_group text,
  p_service_group text,
  p_target_amount_text text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.save_revenue_target(
    p_target_id,
    p_target_year,
    p_organization_level,
    p_group_code,
    p_unit_name,
    p_section_name,
    p_service_level,
    p_business_group,
    p_service_group,
    null::text,
    p_target_amount_text
  );
$$;

create or replace function public.get_op_scoped_revenue_report(p_year integer, p_scope_key text)
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
  v_scope_key text := lower(nullif(btrim(p_scope_key), ''));
  v_scope_level text;
  v_business_group text;
  v_service_group text;
  v_service_name text;
  v_scope_label text;
  v_report_title text;
begin
  select
    s.scope_level,
    s.business_group,
    s.service_group,
    s.service_name,
    s.scope_label,
    s.report_title
  into
    v_scope_level,
    v_business_group,
    v_service_group,
    v_service_name,
    v_scope_label,
    v_report_title
  from (
    values
      ('broadband', 'service_group', '4.Fixed Line & Broadband',
        '4.2.กลุ่มบริการ Internet Retail', null::text,
        'Internet Retail (Broadband)', 'รายได้ Broadband'),
      ('datacom', 'service_group', '4.Fixed Line & Broadband',
        '4.3.กลุ่มบริการวงจรเช่า (Datacom)', null::text,
        'กลุ่มบริการวงจรเช่า (Datacom)', 'รายได้ Datacom'),
      ('fixed-line', 'service_group', '4.Fixed Line & Broadband',
        '4.4.บริการโทรศัพท์ประจำที่ (Fixed Line)', null::text,
        'บริการโทรศัพท์ประจำที่ (Fixed Line)', 'รายได้ Fixed Line'),
      ('mobile-retail', 'service_group', '3.Mobile',
        '3.2.บริการโทรคมนาคมสื่อสารไร้สาย - กลุ่มค้าปลีก (Retail)', null::text,
        'กลุ่มบริการโทรคมนาคมสื่อสารไร้สาย - กลุ่มค้าปลีก (Retail)',
        'รายได้ Mobile Retail'),
      ('ict-solution', 'business_group', '6.ICT Solution', null::text, null::text,
        'กลุ่มธุรกิจ ICT Solution', 'รายได้ ICT-Solution'),
      ('digital', 'business_group', '5.Digital', null::text, null::text,
        'กลุ่มธุรกิจ Digital', 'รายได้ Digital'),
      ('asset-development', 'service_group', '1.Hard Infrastructure',
        '1.4.กลุ่มบริการพัฒนาสินทรัพย์', null::text,
        'กลุ่มบริการพัฒนาสินทรัพย์', 'รายได้พัฒนาสินทรัพย์'),
      ('e-office', 'service', '5.Digital',
        '5.4.กลุ่มบริการ Application & Digital Services', 'บริการ e-Office',
        'บริการ e-Office', 'รายได้ e-Office')
  ) as s(
    scope_key, scope_level, business_group, service_group, service_name, scope_label, report_title
  )
  where s.scope_key = v_scope_key;

  if v_business_group is null then
    raise exception 'INVALID_REPORT_SCOPE';
  end if;
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_year is null or p_year not between 2000 and 2200 then
    raise exception 'INVALID_REPORT_YEAR';
  end if;

  select a.active_batch_id, b.report_end_month
  into v_current_batch, v_current_end
  from public.active_datasets a
  join public.import_batches b on b.id = a.active_batch_id and b.owner_id = a.owner_id
  where a.owner_id = v_owner and a.report_year = p_year;

  if v_current_batch is null then
    raise exception 'ACTIVE_DATASET_NOT_FOUND';
  end if;

  select a.active_batch_id, b.report_end_month
  into v_previous_batch, v_previous_end
  from public.active_datasets a
  join public.import_batches b on b.id = a.active_batch_id and b.owner_id = a.owner_id
  where a.owner_id = v_owner and a.report_year = p_year - 1;

  v_through_month := extract(month from v_current_end)::integer;
  v_has_comparable_previous := v_previous_batch is not null
    and extract(month from v_previous_end)::integer >= v_through_month;

  with
  report_items(
    sort_order, parent_key, item_key, item_level, unit_name, section_name, display_label
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
    select r.unit_name, r.section_name, coalesce(r.revenue_amount, 0) as amount
    from public.revenue_import_rows r
    join public.organization_group_units gu
      on gu.unit_name = r.unit_name and gu.group_code = 'อป.'
    where r.owner_id = v_owner
      and r.batch_id = v_current_batch
      and r.business_group = v_business_group
      and (v_scope_level = 'business_group' or r.service_group = v_service_group)
      and (v_scope_level <> 'service' or r.service_name = v_service_name)
      and r.period_month between make_date(p_year, 1, 1) and v_current_end
  ),
  previous_rows as materialized (
    select r.unit_name, r.section_name, coalesce(r.revenue_amount, 0) as amount
    from public.revenue_import_rows r
    join public.organization_group_units gu
      on gu.unit_name = r.unit_name and gu.group_code = 'อป.'
    where v_has_comparable_previous
      and r.owner_id = v_owner
      and r.batch_id = v_previous_batch
      and r.business_group = v_business_group
      and (v_scope_level = 'business_group' or r.service_group = v_service_group)
      and (v_scope_level <> 'service' or r.service_name = v_service_name)
      and r.period_month between make_date(p_year - 1, 1, 1)
        and make_date(p_year - 1, v_through_month, 1)
  ),
  current_section_totals as (
    select unit_name, section_name, sum(amount) as revenue
    from current_rows group by unit_name, section_name
  ),
  current_unit_totals as (
    select unit_name, sum(amount) as revenue from current_rows group by unit_name
  ),
  current_group_total as (select coalesce(sum(amount), 0) as revenue from current_rows),
  previous_section_totals as (
    select unit_name, section_name, sum(amount) as revenue
    from previous_rows group by unit_name, section_name
  ),
  previous_unit_totals as (
    select unit_name, sum(amount) as revenue from previous_rows group by unit_name
  ),
  previous_group_total as (select coalesce(sum(amount), 0) as revenue from previous_rows),
  matching_targets as materialized (
    select t.*
    from public.revenue_targets t
    where t.owner_id = v_owner
      and t.target_year = p_year
      and t.service_level = v_scope_level
      and t.business_group = v_business_group
      and (
        (v_scope_level = 'business_group'
          and t.service_group is null and t.service_name is null)
        or (v_scope_level = 'service_group'
          and t.service_group = v_service_group and t.service_name is null)
        or (v_scope_level = 'service'
          and t.service_group = v_service_group and t.service_name = v_service_name)
      )
      and (
        (t.organization_level = 'group' and t.group_code = 'อป.')
        or (t.organization_level = 'unit' and t.unit_name in ('อป.1', 'อป.2'))
        or (t.organization_level = 'section' and t.unit_name in ('อป.1', 'อป.2'))
      )
  ),
  row_values as (
    select
      i.*,
      coalesce(case i.item_level
        when 'section' then cs.revenue
        when 'department' then cu.revenue
        else cg.revenue end, 0) as current_ytd_revenue,
      case when not v_has_comparable_previous then null else coalesce(
        case i.item_level
          when 'section' then ps.revenue
          when 'department' then pu.revenue
          else pg.revenue end,
        0) end as previous_comparison_revenue,
      t.target_amount as annual_target
    from report_items i
    left join current_section_totals cs
      on i.item_level = 'section'
      and cs.unit_name = i.unit_name and cs.section_name = i.section_name
    left join current_unit_totals cu
      on i.item_level = 'department' and cu.unit_name = i.unit_name
    left join current_group_total cg on i.item_level = 'group'
    left join previous_section_totals ps
      on i.item_level = 'section'
      and ps.unit_name = i.unit_name and ps.section_name = i.section_name
    left join previous_unit_totals pu
      on i.item_level = 'department' and pu.unit_name = i.unit_name
    left join previous_group_total pg on i.item_level = 'group'
    left join matching_targets t on
      (i.item_level = 'group' and t.organization_level = 'group' and t.group_code = 'อป.')
      or (i.item_level = 'department' and t.organization_level = 'unit'
        and t.unit_name = i.unit_name)
      or (i.item_level = 'section' and t.organization_level = 'section'
        and t.unit_name = i.unit_name and t.section_name = i.section_name)
  ),
  row_metrics as (
    select
      r.*,
      case when r.previous_comparison_revenue is null then null
        else r.current_ytd_revenue - r.previous_comparison_revenue end as difference,
      case when r.previous_comparison_revenue is null or r.previous_comparison_revenue = 0
        then null else (r.current_ytd_revenue - r.previous_comparison_revenue)
          / abs(r.previous_comparison_revenue) * 100 end as difference_percent,
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
    select count(annual_target)::integer as configured_target_count,
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
      'groupCode', 'อป.', 'groupName', 'ภาคตะวันออก', 'label', 'อป. — ภาคตะวันออก'
    ),
    'scope', jsonb_build_object(
      'key', v_scope_key,
      'level', v_scope_level,
      'businessGroup', v_business_group,
      'serviceGroup', v_service_group,
      'serviceName', v_service_name,
      'label', v_scope_label,
      'reportTitle', v_report_title
    ),
    'targetPacePercent', round(v_through_month::numeric / 12 * 100, 2)::text,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', item_key,
        'sortOrder', sort_order,
        'parentKey', parent_key,
        'level', item_level,
        'unitName', unit_name,
        'sectionName', section_name,
        'label', display_label,
        'currentYtdRevenueBaht', current_ytd_revenue::numeric(20,2)::text,
        'previousComparisonRevenueBaht', case when previous_comparison_revenue is null then null
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
      ) order by sort_order) from row_metrics
    ), '[]'::jsonb),
    'totals', (
      select jsonb_build_object(
        'currentYtdRevenueBaht', r.current_ytd_revenue::numeric(20,2)::text,
        'previousComparisonRevenueBaht', case when r.previous_comparison_revenue is null then null
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
      from row_metrics r cross join target_stats s
      where r.item_level = 'group'
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.save_revenue_target(
  uuid, integer, text, text, text, text, text, text, text, text, text
) from public;
revoke all on function public.save_revenue_target(
  uuid, integer, text, text, text, text, text, text, text, text
) from public;
revoke all on function public.get_revenue_target_setup(integer) from public;
revoke all on function public.get_op_scoped_revenue_report(integer, text) from public;

grant execute on function public.save_revenue_target(
  uuid, integer, text, text, text, text, text, text, text, text, text
) to authenticated;
grant execute on function public.save_revenue_target(
  uuid, integer, text, text, text, text, text, text, text, text
) to authenticated;
grant execute on function public.get_revenue_target_setup(integer) to authenticated;
grant execute on function public.get_op_scoped_revenue_report(integer, text) to authenticated;

notify pgrst, 'reload schema';
