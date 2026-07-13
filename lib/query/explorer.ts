import { z } from "zod";

import type { Json } from "@/lib/supabase/database.types";
import type { RevenueFilters } from "@/lib/revenue/types";
import { createClient } from "@/lib/supabase/client";

const explorerItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  unitName: z.string(),
  sectionName: z.string(),
  costCenter: z.string(),
  businessGroup: z.string(),
  serviceGroup: z.string(),
  productCode: z.string(),
  serviceName: z.string(),
  selectedMonthRevenue: z.string(),
  ytdRevenue: z.string(),
  previousMonthRevenue: z.string().nullable(),
  momAmount: z.string().nullable(),
  momPercent: z.string().nullable(),
  sharePercent: z.string().nullable(),
  drillFilters: z.record(z.string(), z.array(z.string())),
});

const explorerResponseSchema = z.object({
  items: z.array(explorerItemSchema),
  page: z.number(),
  pageSize: z.number(),
  totalItems: z.number(),
  totalPages: z.number(),
});

export type ExplorerResponse = z.infer<typeof explorerResponseSchema>;
export type ExplorerLevel = "unit" | "section" | "business_group" | "service_group" | "service";

export async function fetchExplorerRows(input: {
  year: number;
  month: number;
  level: ExplorerLevel;
  filters: RevenueFilters;
  search: string | null;
  sortBy: string;
  sortDirection: "asc" | "desc";
  page: number;
  pageSize: number;
  signal?: AbortSignal;
}) {
  const { data, error } = await createClient()
    .rpc("get_explorer_rows", {
      p_year: input.year,
      p_month: input.month,
      p_level: input.level,
      p_filters: input.filters as Json,
      p_search: input.search,
      p_sort_by: input.sortBy,
      p_sort_direction: input.sortDirection,
      p_page: input.page,
      p_page_size: input.pageSize,
    })
    .abortSignal(input.signal ?? new AbortController().signal);
  if (error) throw new Error(error.message);
  return explorerResponseSchema.parse(data);
}
