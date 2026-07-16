begin;

select plan(18);

select has_table('public', 'import_batches', 'import_batches exists');
select has_table('public', 'revenue_import_rows', 'revenue_import_rows exists');
select has_table('public', 'active_datasets', 'active_datasets exists');
select has_table('public', 'organization_groups', 'organization_groups exists');
select has_table('public', 'organization_group_units', 'organization_group_units exists');
select has_table('public', 'revenue_targets', 'revenue_targets exists');
select has_view('public', 'current_revenue_rows', 'current revenue view exists');
select policies_are('public', 'import_batches', array[
  'import_batches_select_permitted',
  'import_batches_insert_own',
  'import_batches_update_own',
  'import_batches_delete_unpublished'
], 'import batch policies are explicit');
select policies_are('public', 'active_datasets', array['active_datasets_select_permitted'], 'active pointer is read-only to clients');
select policies_are('public', 'revenue_targets', array['revenue_targets_select_permitted'], 'revenue targets are read-only to clients');
select has_function('public', 'publish_import_batch', array['uuid'], 'publish RPC exists');
select has_function('public', 'get_dashboard_kpis', array['integer', 'integer', 'jsonb'], 'dashboard KPI RPC exists');
select has_function('public', 'get_organization_overview_report', array['integer'], 'organization overview RPC exists');
select has_function('public', 'get_op_service_overview_report', array['integer'], 'OP service overview RPC exists');
select has_function('public', 'delete_unpublished_import', array['uuid'], 'delete unpublished RPC exists');
select has_function('public', 'get_revenue_target_setup', array['integer'], 'revenue target setup RPC exists');
select has_function(
  'public',
  'save_revenue_target',
  array['uuid', 'integer', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text'],
  'save revenue target RPC exists'
);
select has_function('public', 'delete_revenue_target', array['uuid'], 'delete revenue target RPC exists');

select * from finish();
rollback;
