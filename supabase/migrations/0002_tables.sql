create table public.import_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  original_filename text not null,
  file_hash text not null,
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  source_sheet_name text not null,
  header_row integer not null check (header_row > 0),
  report_year integer not null check (report_year between 2000 and 2200),
  report_end_month date not null,
  status text not null check (status in ('uploading', 'validated', 'published', 'superseded', 'failed')),
  source_row_count integer not null default 0,
  detail_row_count integer not null default 0,
  generated_revenue_row_count integer not null default 0,
  excluded_row_count integer not null default 0,
  blank_revenue_cell_count integer not null default 0,
  zero_revenue_cell_count integer not null default 0,
  negative_revenue_cell_count integer not null default 0,
  negative_revenue_amount numeric(18,2) not null default 0,
  current_month_revenue numeric(18,2) not null default 0,
  ytd_revenue numeric(18,2) not null default 0,
  monthly_totals jsonb not null default '[]'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  storage_path text,
  failure_message text,
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint report_end_month_matches_year check (extract(year from report_end_month)::integer = report_year),
  constraint import_counts_nonnegative check (
    source_row_count >= 0 and detail_row_count >= 0 and generated_revenue_row_count >= 0
    and excluded_row_count >= 0 and blank_revenue_cell_count >= 0
    and zero_revenue_cell_count >= 0 and negative_revenue_cell_count >= 0
  )
);

create table public.revenue_import_rows (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_row_number integer not null check (source_row_number > 0),
  record_key text not null,
  period_month date not null check (extract(day from period_month) = 1),
  unit_name text not null,
  section_name text not null,
  cost_center text not null,
  business_group text not null,
  service_group text not null,
  product_code text not null,
  service_name text not null,
  revenue_amount numeric(18,2),
  source_is_blank boolean not null default false,
  created_at timestamptz not null default now(),
  constraint blank_amount_consistency check (
    (source_is_blank = true and revenue_amount is null)
    or (source_is_blank = false and revenue_amount is not null)
  ),
  constraint unique_batch_period_record unique(batch_id, period_month, record_key)
);

create table public.active_datasets (
  owner_id uuid not null references auth.users(id) on delete cascade,
  report_year integer not null check (report_year between 2000 and 2200),
  active_batch_id uuid not null references public.import_batches(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key(owner_id, report_year)
);

create table public.app_health (
  id integer primary key check (id = 1),
  last_ping_at timestamptz not null default now()
);

insert into public.app_health(id) values (1) on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger import_batches_set_updated_at
before update on public.import_batches
for each row execute function public.set_updated_at();
