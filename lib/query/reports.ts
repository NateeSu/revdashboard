import { z } from "zod";

import type { Json } from "@/lib/supabase/database.types";
import type { RevenueFilters } from "@/lib/revenue/types";
import { createClient } from "@/lib/supabase/client";

const reportRowSchema = z.object({
  sectionName: z.string(),
  monthlyRevenue: z.record(z.string(), z.string()),
  ytdRevenue: z.string(),
});

const revenueMatrixReportSchema = z.object({
  reportYear: z.number(),
  throughMonth: z.number(),
  months: z.array(z.string()),
  rows: z.array(reportRowSchema),
  totals: z.object({
    monthlyRevenue: z.record(z.string(), z.string()),
    ytdRevenue: z.string(),
  }),
});

export type RevenueMatrixReport = z.infer<typeof revenueMatrixReportSchema>;

export async function fetchRevenueMatrixReport(input: {
  year: number;
  month: number;
  filters: RevenueFilters;
  signal?: AbortSignal;
}) {
  const { data, error } = await createClient()
    .rpc("get_revenue_matrix_report", {
      p_year: input.year,
      p_month: input.month,
      p_filters: input.filters as Json,
    })
    .abortSignal(input.signal ?? new AbortController().signal);

  if (error) throw new Error(error.message);
  return revenueMatrixReportSchema.parse(data);
}
