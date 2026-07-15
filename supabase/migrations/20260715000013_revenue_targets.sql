create table public.organization_groups (
  group_code text primary key,
  group_name text not null,
  sort_order integer not null unique check (sort_order > 0),
  constraint organization_groups_code_not_blank check (length(btrim(group_code)) > 0),
  constraint organization_groups_name_not_blank check (length(btrim(group_name)) > 0)
);

create table public.organization_group_units (
  unit_name text primary key,
  group_code text not null references public.organization_groups(group_code) on update cascade,
  constraint organization_group_units_name_not_blank check (length(btrim(unit_name)) > 0)
);

insert into public.organization_groups(group_code, group_name, sort_order)
values
  ('นป.', 'ภาคเหนือ', 1),
  ('ตป.', 'ภาคตะวันออกเฉียงเหนือ', 2),
  ('อป.', 'ภาคตะวันออก', 3)
on conflict (group_code) do update
set group_name = excluded.group_name,
    sort_order = excluded.sort_order;

insert into public.organization_group_units(unit_name, group_code)
values
  ('นป.1', 'นป.'),
  ('นป.2', 'นป.'),
  ('ตป.1', 'ตป.'),
  ('ตป.2', 'ตป.'),
  ('อป.1', 'อป.'),
  ('อป.2', 'อป.')
on conflict (unit_name) do update
set group_code = excluded.group_code;

create table public.revenue_targets (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  target_year integer not null check (target_year between 2000 and 2200),
  organization_level text not null check (organization_level in ('group', 'unit', 'section')),
  group_code text references public.organization_groups(group_code) on update cascade,
  unit_name text,
  section_name text,
  service_level text not null check (service_level in ('all', 'business_group', 'service_group')),
  business_group text,
  service_group text,
  target_amount numeric(20,2) not null check (target_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint revenue_targets_organization_scope_valid check (
    (organization_level = 'group'
      and group_code is not null
      and unit_name is null
      and section_name is null)
    or
    (organization_level = 'unit'
      and group_code is null
      and unit_name is not null
      and length(btrim(unit_name)) > 0
      and section_name is null)
    or
    (organization_level = 'section'
      and group_code is null
      and unit_name is not null
      and length(btrim(unit_name)) > 0
      and section_name is not null
      and length(btrim(section_name)) > 0)
  ),
  constraint revenue_targets_service_scope_valid check (
    (service_level = 'all'
      and business_group is null
      and service_group is null)
    or
    (service_level = 'business_group'
      and business_group is not null
      and length(btrim(business_group)) > 0
      and service_group is null)
    or
    (service_level = 'service_group'
      and business_group is not null
      and length(btrim(business_group)) > 0
      and service_group is not null
      and length(btrim(service_group)) > 0)
  ),
  constraint revenue_targets_scope_unique unique nulls not distinct (
    owner_id,
    target_year,
    organization_level,
    group_code,
    unit_name,
    section_name,
    service_level,
    business_group,
    service_group
  )
);

create index revenue_targets_owner_year_idx
on public.revenue_targets(owner_id, target_year);

create index organization_group_units_group_idx
on public.organization_group_units(group_code, unit_name);

create trigger revenue_targets_set_updated_at
before update on public.revenue_targets
for each row execute function public.set_updated_at();

alter table public.revenue_targets enable row level security;

create policy revenue_targets_select_permitted on public.revenue_targets
for select to authenticated
using (owner_id = (select public.current_data_owner_id()));

revoke all on table public.organization_groups from anon, authenticated;
revoke all on table public.organization_group_units from anon, authenticated;
revoke all on table public.revenue_targets from anon, authenticated;
grant select on table public.organization_groups to authenticated;
grant select on table public.organization_group_units to authenticated;
grant select on table public.revenue_targets to authenticated;

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

  if v_service_level is null or v_service_level not in ('all', 'business_group', 'service_group') then
    raise exception 'INVALID_SERVICE_LEVEL';
  end if;

  v_group_code := case
    when v_organization_level = 'group' then nullif(btrim(p_group_code), '')
    else null
  end;
  v_unit_name := case
    when v_organization_level in ('unit', 'section') then nullif(btrim(p_unit_name), '')
    else null
  end;
  v_section_name := case
    when v_organization_level = 'section' then nullif(btrim(p_section_name), '')
    else null
  end;
  v_business_group := case
    when v_service_level in ('business_group', 'service_group')
      then nullif(btrim(p_business_group), '')
    else null
  end;
  v_service_group := case
    when v_service_level = 'service_group' then nullif(btrim(p_service_group), '')
    else null
  end;

  if v_organization_level = 'group' and v_group_code is null then
    raise exception 'GROUP_REQUIRED';
  end if;
  if v_organization_level in ('unit', 'section') and v_unit_name is null then
    raise exception 'UNIT_REQUIRED';
  end if;
  if v_organization_level = 'section' and v_section_name is null then
    raise exception 'SECTION_REQUIRED';
  end if;
  if v_service_level in ('business_group', 'service_group') and v_business_group is null then
    raise exception 'BUSINESS_GROUP_REQUIRED';
  end if;
  if v_service_level = 'service_group' and v_service_group is null then
    raise exception 'SERVICE_GROUP_REQUIRED';
  end if;

  select a.active_batch_id
  into v_option_batch
  from public.active_datasets a
  where a.owner_id = v_owner
  order by (a.report_year = p_target_year) desc, a.report_year desc
  limit 1;

  if v_organization_level = 'group' and not exists (
    select 1
    from public.organization_groups g
    where g.group_code = v_group_code
  ) then
    raise exception 'GROUP_NOT_FOUND';
  end if;

  if v_organization_level = 'unit' and (
    v_option_batch is null or not exists (
      select 1
      from public.revenue_import_rows r
      where r.owner_id = v_owner
        and r.batch_id = v_option_batch
        and r.unit_name = v_unit_name
    )
  ) and not exists (
    select 1
    from public.revenue_targets t
    where t.id = p_target_id
      and t.owner_id = v_owner
      and t.organization_level = 'unit'
      and t.unit_name = v_unit_name
  ) then
    raise exception 'UNIT_NOT_FOUND';
  end if;

  if v_organization_level = 'section' and (
    v_option_batch is null or not exists (
      select 1
      from public.revenue_import_rows r
      where r.owner_id = v_owner
        and r.batch_id = v_option_batch
        and r.unit_name = v_unit_name
        and r.section_name = v_section_name
    )
  ) and not exists (
    select 1
    from public.revenue_targets t
    where t.id = p_target_id
      and t.owner_id = v_owner
      and t.organization_level = 'section'
      and t.unit_name = v_unit_name
      and t.section_name = v_section_name
  ) then
    raise exception 'SECTION_NOT_FOUND';
  end if;

  if v_service_level = 'business_group' and (
    v_option_batch is null or not exists (
      select 1
      from public.revenue_import_rows r
      where r.owner_id = v_owner
        and r.batch_id = v_option_batch
        and r.business_group = v_business_group
    )
  ) and not exists (
    select 1
    from public.revenue_targets t
    where t.id = p_target_id
      and t.owner_id = v_owner
      and t.service_level = 'business_group'
      and t.business_group = v_business_group
  ) then
    raise exception 'BUSINESS_GROUP_NOT_FOUND';
  end if;

  if v_service_level = 'service_group' and (
    v_option_batch is null or not exists (
      select 1
      from public.revenue_import_rows r
      where r.owner_id = v_owner
        and r.batch_id = v_option_batch
        and r.business_group = v_business_group
        and r.service_group = v_service_group
    )
  ) and not exists (
    select 1
    from public.revenue_targets t
    where t.id = p_target_id
      and t.owner_id = v_owner
      and t.service_level = 'service_group'
      and t.business_group = v_business_group
      and t.service_group = v_service_group
  ) then
    raise exception 'SERVICE_GROUP_NOT_FOUND';
  end if;

  if p_target_id is null then
    insert into public.revenue_targets (
      owner_id,
      target_year,
      organization_level,
      group_code,
      unit_name,
      section_name,
      service_level,
      business_group,
      service_group,
      target_amount
    )
    values (
      v_owner,
      p_target_year,
      v_organization_level,
      v_group_code,
      v_unit_name,
      v_section_name,
      v_service_level,
      v_business_group,
      v_service_group,
      v_target_amount
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
        target_amount = v_target_amount
    where id = p_target_id and owner_id = v_owner
    returning id into v_target_id;

    if v_target_id is null then
      raise exception 'TARGET_NOT_FOUND';
    end if;
  end if;

  return jsonb_build_object(
    'id', v_target_id,
    'targetAmountBaht', v_target_amount::text
  );
exception
  when unique_violation then
    raise exception 'TARGET_SCOPE_ALREADY_EXISTS';
end;
$$;

create or replace function public.delete_revenue_target(p_target_id uuid)
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
  v_deleted uuid;
begin
  if v_owner is null then
    raise exception 'WRITE_ACCESS_REQUIRED' using errcode = '42501';
  end if;

  delete from public.revenue_targets
  where id = p_target_id and owner_id = v_owner
  returning id into v_deleted;

  if v_deleted is null then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  return jsonb_build_object('id', v_deleted, 'deleted', true);
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
  join public.import_batches b
    on b.id = a.active_batch_id and b.owner_id = a.owner_id
  where a.owner_id = v_owner and a.report_year = p_year;

  select a.active_batch_id, a.report_year
  into v_option_batch, v_option_year
  from public.active_datasets a
  where a.owner_id = v_owner
  order by (a.report_year = p_year) desc, a.report_year desc
  limit 1;

  with
  years as (
    select a.report_year
    from public.active_datasets a
    where a.owner_id = v_owner
    union
    select t.target_year
    from public.revenue_targets t
    where t.owner_id = v_owner
    union
    select p_year
    union
    select v_current_year
    union
    select v_current_year + 1
  ),
  option_rows as materialized (
    select
      r.unit_name,
      r.section_name,
      r.business_group,
      r.service_group
    from public.revenue_import_rows r
    where r.owner_id = v_owner and r.batch_id = v_option_batch
  ),
  target_progress as (
    select
      t.*,
      case
        when v_data_batch is null then null
        else coalesce(sum(r.revenue_amount), 0)
      end as actual_amount
    from public.revenue_targets t
    left join public.revenue_import_rows r
      on v_data_batch is not null
      and r.owner_id = v_owner
      and r.batch_id = v_data_batch
      and r.period_month between make_date(p_year, 1, 1) and v_data_end
      and (
        (t.organization_level = 'group' and exists (
          select 1
          from public.organization_group_units gu
          where gu.group_code = t.group_code and gu.unit_name = r.unit_name
        ))
        or (t.organization_level = 'unit' and r.unit_name = t.unit_name)
        or (t.organization_level = 'section'
          and r.unit_name = t.unit_name
          and r.section_name = t.section_name)
      )
      and (
        t.service_level = 'all'
        or (t.service_level = 'business_group' and r.business_group = t.business_group)
        or (t.service_level = 'service_group'
          and r.business_group = t.business_group
          and r.service_group = t.service_group)
      )
    where t.owner_id = v_owner and t.target_year = p_year
    group by t.id
  )
  select jsonb_build_object(
    'targetYear', p_year,
    'hasYearData', v_data_batch is not null,
    'throughMonth', case when v_data_end is null then null else extract(month from v_data_end)::integer end,
    'optionsSourceYear', v_option_year,
    'yearOptions', coalesce((
      select jsonb_agg(y.report_year order by y.report_year desc)
      from years y
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'code', g.group_code,
          'name', g.group_name,
          'label', g.group_code || ' — ' || g.group_name
        ) order by g.sort_order
      )
      from public.organization_groups g
    ), '[]'::jsonb),
    'units', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', u.unit_name,
          'groupCode', gu.group_code
        ) order by coalesce(g.sort_order, 999), u.unit_name
      )
      from (select distinct o.unit_name from option_rows o) u
      left join public.organization_group_units gu on gu.unit_name = u.unit_name
      left join public.organization_groups g on g.group_code = gu.group_code
    ), '[]'::jsonb),
    'sections', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'unitName', s.unit_name,
          'name', s.section_name
        ) order by s.unit_name, s.section_name
      )
      from (
        select distinct o.unit_name, o.section_name
        from option_rows o
      ) s
    ), '[]'::jsonb),
    'businessGroups', coalesce((
      select jsonb_agg(b.business_group order by b.business_group)
      from (select distinct o.business_group from option_rows o) b
    ), '[]'::jsonb),
    'serviceGroups', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'businessGroup', s.business_group,
          'name', s.service_group
        ) order by s.business_group, s.service_group
      )
      from (
        select distinct o.business_group, o.service_group
        from option_rows o
      ) s
    ), '[]'::jsonb),
    'targets', coalesce((
      select jsonb_agg(
        jsonb_build_object(
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
          'serviceLabel', case
            when t.service_level = 'all' then 'ทุกบริการ'
            when t.service_level = 'business_group' then 'กลุ่มธุรกิจ ' || t.business_group
            else 'กลุ่มบริการ ' || t.service_group || ' · ' || t.business_group
          end,
          'targetAmountBaht', t.target_amount::text,
          'targetAmountMillion', (t.target_amount / 1000000)::numeric(20,2)::text,
          'actualRevenueBaht', case
            when t.actual_amount is null then null
            else t.actual_amount::numeric(20,2)::text
          end,
          'remainingAmountBaht', case
            when t.actual_amount is null then null
            else (t.target_amount - t.actual_amount)::numeric(20,2)::text
          end,
          'achievementPercent', case
            when t.actual_amount is null then null
            else round((t.actual_amount / t.target_amount) * 100, 2)::text
          end,
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
              else exists (
                select 1 from option_rows o
                where o.business_group = t.business_group and o.service_group = t.service_group
              )
            end
          ),
          'createdAt', t.created_at,
          'updatedAt', t.updated_at
        ) order by t.updated_at desc, t.created_at desc
      )
      from target_progress t
      left join public.organization_groups g on g.group_code = t.group_code
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.save_revenue_target(
  uuid, integer, text, text, text, text, text, text, text, text
) from public;
revoke all on function public.delete_revenue_target(uuid) from public;
revoke all on function public.get_revenue_target_setup(integer) from public;

grant execute on function public.save_revenue_target(
  uuid, integer, text, text, text, text, text, text, text, text
) to authenticated;
grant execute on function public.delete_revenue_target(uuid) to authenticated;
grant execute on function public.get_revenue_target_setup(integer) to authenticated;
