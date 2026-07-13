import { z } from "zod";

import type { Json } from "@/lib/supabase/database.types";
import type { RevenueFilters } from "@/lib/revenue/types";
import { createClient } from "@/lib/supabase/client";

const kpiSchema = z.object({
  selectedMonthRevenue: z.string(),
  ytdRevenue: z.string(),
  previousMonthRevenue: z.string().nullable(),
  momAmount: z.string().nullable(),
  momPercent: z.string().nullable(),
  activeServiceCount: z.number(),
  negativeRecordCount: z.number(),
  negativeRevenueAmount: z.string(),
});

export type DashboardKpis = z.infer<typeof kpiSchema>;

export type GroupedRevenue = {
  group_key: string;
  group_label: string;
  selected_month_revenue: string;
  ytd_revenue: string;
  previous_month_revenue: string | null;
  mom_amount: string | null;
  mom_percent: string | null;
  share_percent: string | null;
};

export type NegativeRevenue = {
  record_key: string;
  unit_name: string;
  service_group: string;
  service_name: string;
  revenue_amount: string | null;
};

export async function fetchDashboardData(
  year: number,
  month: number,
  filters: RevenueFilters,
  signal?: AbortSignal
) {
  const supabase = createClient();
  const filterJson = filters as Json;
  const period = `${year}-${String(month).padStart(2, "0")}-01`;
  const requestSignal = signal ?? new AbortController().signal;

  let negativeQuery = supabase
    .from("current_revenue_rows")
    .select("record_key,unit_name,service_group,service_name,revenue_amount")
    .eq("period_month", period)
    .lt("revenue_amount", 0)
    .order("revenue_amount", { ascending: true })
    .limit(10);
  if (filters.unitNames?.length) negativeQuery = negativeQuery.in("unit_name", filters.unitNames);
  if (filters.sectionNames?.length)
    negativeQuery = negativeQuery.in("section_name", filters.sectionNames);
  if (filters.costCenters?.length)
    negativeQuery = negativeQuery.in("cost_center", filters.costCenters);
  if (filters.businessGroups?.length)
    negativeQuery = negativeQuery.in("business_group", filters.businessGroups);
  if (filters.serviceGroups?.length)
    negativeQuery = negativeQuery.in("service_group", filters.serviceGroups);
  if (filters.productCodes?.length)
    negativeQuery = negativeQuery.in("product_code", filters.productCodes);
  if (filters.serviceNames?.length)
    negativeQuery = negativeQuery.in("service_name", filters.serviceNames);

  const [
    kpiResponse,
    trendResponse,
    unitResponse,
    businessResponse,
    serviceGroupResponse,
    serviceResponse,
    negativeResponse,
  ] = await Promise.all([
    supabase
      .rpc("get_dashboard_kpis", { p_year: year, p_month: month, p_filters: filterJson })
      .abortSignal(requestSignal),
    supabase
      .rpc("get_monthly_trend", {
        p_year: year,
        p_month: month,
        p_filters: filterJson,
      })
      .abortSignal(requestSignal),
    supabase
      .rpc("get_grouped_revenue", {
        p_year: year,
        p_month: month,
        p_group_by: "unit_name",
        p_filters: filterJson,
        p_limit: 20,
      })
      .abortSignal(requestSignal),
    supabase
      .rpc("get_grouped_revenue", {
        p_year: year,
        p_month: month,
        p_group_by: "business_group",
        p_filters: filterJson,
        p_limit: 20,
      })
      .abortSignal(requestSignal),
    supabase
      .rpc("get_grouped_revenue", {
        p_year: year,
        p_month: month,
        p_group_by: "service_group",
        p_filters: filterJson,
        p_limit: 10,
      })
      .abortSignal(requestSignal),
    supabase
      .rpc("get_grouped_revenue", {
        p_year: year,
        p_month: month,
        p_group_by: "service_name",
        p_filters: filterJson,
        p_limit: 10,
      })
      .abortSignal(requestSignal),
    negativeQuery.abortSignal(requestSignal),
  ]);

  const error = [
    kpiResponse,
    trendResponse,
    unitResponse,
    businessResponse,
    serviceGroupResponse,
    serviceResponse,
    negativeResponse,
  ]
    .map((response) => response.error)
    .find(Boolean);
  if (error) throw new Error(error.message);

  return {
    kpis: kpiSchema.parse(kpiResponse.data),
    trend: trendResponse.data ?? [],
    units: unitResponse.data ?? [],
    businessGroups: businessResponse.data ?? [],
    serviceGroups: serviceGroupResponse.data ?? [],
    services: serviceResponse.data ?? [],
    negativeRows: (negativeResponse.data ?? []) as NegativeRevenue[],
  };
}

export async function fetchDimensionOptions(year: number) {
  const supabase = createClient();
  const pageSize = 1_000;
  const options = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .rpc("get_dimension_options", { p_year: year })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);

    const page = data ?? [];
    options.push(...page);
    if (page.length < pageSize) break;
  }

  return options;
}
