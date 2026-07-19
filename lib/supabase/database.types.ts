export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ImportStatus = "uploading" | "validated" | "published" | "superseded" | "failed";

export type ImportBatchRow = {
  id: string;
  owner_id: string;
  original_filename: string;
  file_hash: string;
  file_size_bytes: number;
  source_sheet_name: string;
  header_row: number;
  report_year: number;
  report_end_month: string;
  status: ImportStatus;
  source_row_count: number;
  detail_row_count: number;
  generated_revenue_row_count: number;
  excluded_row_count: number;
  blank_revenue_cell_count: number;
  zero_revenue_cell_count: number;
  negative_revenue_cell_count: number;
  negative_revenue_amount: string;
  current_month_revenue: string;
  ytd_revenue: string;
  monthly_totals: Json;
  validation_summary: Json;
  storage_path: string | null;
  failure_message: string | null;
  created_at: string;
  validated_at: string | null;
  published_at: string | null;
  updated_at: string;
};

export type RevenueImportRow = {
  id: number;
  batch_id: string;
  owner_id: string;
  source_row_number: number;
  record_key: string;
  period_month: string;
  unit_name: string;
  section_name: string;
  cost_center: string;
  business_group: string;
  service_group: string;
  product_code: string;
  service_name: string;
  revenue_amount: string | null;
  source_is_blank: boolean;
  created_at: string;
};

export type RevenueTargetRow = {
  id: string;
  owner_id: string;
  target_year: number;
  organization_level: "group" | "unit" | "section";
  group_code: string | null;
  unit_name: string | null;
  section_name: string | null;
  service_level: "all" | "business_group" | "service_group";
  business_group: string | null;
  service_group: string | null;
  target_amount: string;
  created_at: string;
  updated_at: string;
};

type ImportBatchInsert = Omit<
  ImportBatchRow,
  "id" | "created_at" | "updated_at" | "validated_at" | "published_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  validated_at?: string | null;
  published_at?: string | null;
};

type RevenueImportInsert = Omit<RevenueImportRow, "id" | "created_at"> & {
  id?: number;
  created_at?: string;
};

export type Database = {
  public: {
    Tables: {
      import_batches: {
        Row: ImportBatchRow;
        Insert: ImportBatchInsert;
        Update: Partial<ImportBatchInsert>;
        Relationships: [];
      };
      revenue_import_rows: {
        Row: RevenueImportRow;
        Insert: RevenueImportInsert;
        Update: never;
        Relationships: [];
      };
      active_datasets: {
        Row: { owner_id: string; report_year: number; active_batch_id: string; updated_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      organization_groups: {
        Row: { group_code: string; group_name: string; sort_order: number };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      organization_group_units: {
        Row: { unit_name: string; group_code: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      revenue_targets: {
        Row: RevenueTargetRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      app_health: {
        Row: { id: number; last_ping_at: string };
        Insert: { id?: number; last_ping_at?: string };
        Update: { last_ping_at?: string };
        Relationships: [];
      };
    };
    Views: {
      current_revenue_rows: { Row: RevenueImportRow; Relationships: [] };
    };
    Functions: {
      publish_import_batch: { Args: { p_batch_id: string }; Returns: Json };
      get_available_years: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{
          report_year: number;
          active_batch_id: string;
          report_end_month: string;
          current_month_revenue: string;
          ytd_revenue: string;
        }>;
      };
      get_dimension_options: {
        Args: { p_year: number };
        Returns: Array<{
          unit_name: string;
          section_name: string;
          cost_center: string;
          business_group: string;
          service_group: string;
          product_code: string;
          service_name: string;
        }>;
      };
      get_dashboard_kpis: {
        Args: { p_year: number; p_month: number; p_filters?: Json };
        Returns: Json;
      };
      get_monthly_trend: {
        Args: { p_year: number; p_month: number; p_filters?: Json };
        Returns: Array<{ period_month: string; revenue: string }>;
      };
      get_grouped_revenue: {
        Args: {
          p_year: number;
          p_month: number;
          p_group_by: string;
          p_filters?: Json;
          p_limit?: number;
        };
        Returns: Array<{
          group_key: string;
          group_label: string;
          selected_month_revenue: string;
          ytd_revenue: string;
          previous_month_revenue: string | null;
          mom_amount: string | null;
          mom_percent: string | null;
          share_percent: string | null;
        }>;
      };
      get_explorer_rows: {
        Args: {
          p_year: number;
          p_month: number;
          p_level: string;
          p_filters?: Json;
          p_search?: string | null;
          p_sort_by?: string;
          p_sort_direction?: string;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: Json;
      };
      get_revenue_matrix_report: {
        Args: { p_year: number; p_month: number; p_filters?: Json };
        Returns: Json;
      };
      get_organization_overview_report: {
        Args: { p_year: number };
        Returns: Json;
      };
      get_op_service_overview_report: {
        Args: { p_year: number };
        Returns: Json;
      };
      get_op_area_overview_report: {
        Args: { p_year: number };
        Returns: Json;
      };
      get_broadband_revenue_report: {
        Args: { p_year: number };
        Returns: Json;
      };
      get_op_scoped_revenue_report: {
        Args: { p_scope_key: string; p_year: number };
        Returns: Json;
      };
      get_revenue_target_setup: {
        Args: { p_year: number };
        Returns: Json;
      };
      save_revenue_target: {
        Args: {
          p_target_id: string | null;
          p_target_year: number;
          p_organization_level: string;
          p_group_code: string | null;
          p_unit_name: string | null;
          p_section_name: string | null;
          p_service_level: string;
          p_business_group: string | null;
          p_service_group: string | null;
          p_target_amount_text: string;
        };
        Returns: Json;
      };
      delete_revenue_target: {
        Args: { p_target_id: string };
        Returns: Json;
      };
      get_year_over_year_comparison: {
        Args: {
          p_year: number;
          p_month: number;
          p_level?: string;
          p_filters?: Json;
        };
        Returns: Json;
      };
      get_export_rows: {
        Args: {
          p_year: number;
          p_month: number;
          p_filters?: Json;
          p_offset?: number;
          p_limit?: number;
        };
        Returns: RevenueImportRow[];
      };
      delete_unpublished_import: { Args: { p_batch_id: string }; Returns: Json };
    };
    Enums: Record<PropertyKey, never>;
    CompositeTypes: Record<PropertyKey, never>;
  };
};
