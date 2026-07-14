import { z } from "zod";

import type { RevenueFilters } from "@/lib/revenue/types";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";

export type YearOverYearLevel = "section" | "service";

const optionalMoneySchema = z.string().nullable();

const yearOverYearRowSchema = z.object({
  key: z.string(),
  unitName: z.string(),
  sectionName: z.string(),
  productCode: z.string().nullable(),
  serviceName: z.string().nullable(),
  matchStatus: z.enum(["both", "current_only", "previous_only"]),
  currentMonthRevenue: z.string(),
  previousMonthRevenue: z.string(),
  monthChange: z.string(),
  monthChangePercent: optionalMoneySchema,
  currentYtdRevenue: z.string(),
  previousYtdRevenue: z.string(),
  ytdChange: z.string(),
  ytdChangePercent: optionalMoneySchema,
});

const yearOverYearSchema = z.object({
  currentYear: z.number(),
  previousYear: z.number(),
  requestedMonth: z.number(),
  comparisonThroughMonth: z.number(),
  level: z.enum(["section", "service"]),
  monthlyTrend: z.array(
    z.object({
      month: z.number(),
      currentRevenue: z.string(),
      previousRevenue: z.string(),
      change: z.string(),
      changePercent: optionalMoneySchema,
    })
  ),
  rows: z.array(yearOverYearRowSchema),
});

export type YearOverYearComparison = z.infer<typeof yearOverYearSchema>;

export async function fetchYearOverYearComparison(input: {
  year: number;
  month: number;
  level: YearOverYearLevel;
  filters: RevenueFilters;
  signal?: AbortSignal;
}): Promise<YearOverYearComparison> {
  const { data, error } = await createClient()
    .rpc("get_year_over_year_comparison", {
      p_year: input.year,
      p_month: input.month,
      p_level: input.level,
      p_filters: input.filters as Json,
    })
    .abortSignal(input.signal ?? new AbortController().signal);

  if (error) throw new Error(error.message);
  return yearOverYearSchema.parse(data);
}
