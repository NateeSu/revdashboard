-- The dashboard runs several aggregate RPCs in parallel. Avoid expanding a JSON
-- array once per dimension and per revenue row, especially for the common empty
-- filter case used when the dashboard first loads.
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
    else (p_filters -> p_key) ? p_value
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
  select p_filters is null
    or p_filters = '{}'::jsonb
    or (
      case when not (p_filters ? 'unitNames') then true
        when jsonb_typeof(p_filters -> 'unitNames') <> 'array' then false
        when jsonb_array_length(p_filters -> 'unitNames') = 0 then true
        else (p_filters -> 'unitNames') ? p_unit_name end
      and case when not (p_filters ? 'sectionNames') then true
        when jsonb_typeof(p_filters -> 'sectionNames') <> 'array' then false
        when jsonb_array_length(p_filters -> 'sectionNames') = 0 then true
        else (p_filters -> 'sectionNames') ? p_section_name end
      and case when not (p_filters ? 'costCenters') then true
        when jsonb_typeof(p_filters -> 'costCenters') <> 'array' then false
        when jsonb_array_length(p_filters -> 'costCenters') = 0 then true
        else (p_filters -> 'costCenters') ? p_cost_center end
      and case when not (p_filters ? 'businessGroups') then true
        when jsonb_typeof(p_filters -> 'businessGroups') <> 'array' then false
        when jsonb_array_length(p_filters -> 'businessGroups') = 0 then true
        else (p_filters -> 'businessGroups') ? p_business_group end
      and case when not (p_filters ? 'serviceGroups') then true
        when jsonb_typeof(p_filters -> 'serviceGroups') <> 'array' then false
        when jsonb_array_length(p_filters -> 'serviceGroups') = 0 then true
        else (p_filters -> 'serviceGroups') ? p_service_group end
      and case when not (p_filters ? 'productCodes') then true
        when jsonb_typeof(p_filters -> 'productCodes') <> 'array' then false
        when jsonb_array_length(p_filters -> 'productCodes') = 0 then true
        else (p_filters -> 'productCodes') ? p_product_code end
      and case when not (p_filters ? 'serviceNames') then true
        when jsonb_typeof(p_filters -> 'serviceNames') <> 'array' then false
        when jsonb_array_length(p_filters -> 'serviceNames') = 0 then true
        else (p_filters -> 'serviceNames') ? p_service_name end
    );
$$;

create index if not exists revenue_rows_batch_period_idx
  on public.revenue_import_rows(batch_id, period_month);
