create view public.current_revenue_rows
with (security_invoker = true)
as
select r.*
from public.revenue_import_rows r
join public.active_datasets a
  on a.active_batch_id = r.batch_id
 and a.owner_id = r.owner_id;

grant select on public.current_revenue_rows to authenticated;
