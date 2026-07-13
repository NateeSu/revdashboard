begin;

select plan(9);

select has_table('public', 'import_batches', 'import_batches exists');
select has_table('public', 'revenue_import_rows', 'revenue_import_rows exists');
select has_table('public', 'active_datasets', 'active_datasets exists');
select has_view('public', 'current_revenue_rows', 'current revenue view exists');
select policies_are('public', 'import_batches', array[
  'import_batches_select_own',
  'import_batches_insert_own',
  'import_batches_update_own',
  'import_batches_delete_unpublished'
], 'import batch policies are explicit');
select policies_are('public', 'active_datasets', array['active_datasets_select_own'], 'active pointer is read-only to clients');
select has_function('public', 'publish_import_batch', array['uuid'], 'publish RPC exists');
select has_function('public', 'get_dashboard_kpis', array['integer', 'integer', 'jsonb'], 'dashboard KPI RPC exists');
select has_function('public', 'delete_unpublished_import', array['uuid'], 'delete unpublished RPC exists');

select * from finish();
rollback;
