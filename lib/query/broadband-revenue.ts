import { z } from "zod";

import { createClient } from "@/lib/supabase/client";

const nullableMoneySchema = z.string().nullable();

const comparisonMetricsSchema = z.object({
  currentYtdRevenueBaht: z.string(),
  previousComparisonRevenueBaht: nullableMoneySchema,
  differenceBaht: nullableMoneySchema,
  differencePercent: nullableMoneySchema,
  annualTargetBaht: nullableMoneySchema,
  expectedTargetBaht: nullableMoneySchema,
  annualTargetPercent: nullableMoneySchema,
  expectedTargetPercent: nullableMoneySchema,
  expectedTargetVarianceBaht: nullableMoneySchema,
});

const broadbandRevenueRowSchema = comparisonMetricsSchema.extend({
  key: z.string(),
  sortOrder: z.number().int(),
  parentKey: z.string().nullable(),
  level: z.enum(["group", "department", "section"]),
  unitName: z.enum(["อป.1", "อป.2"]).nullable(),
  sectionName: z.string().nullable(),
  label: z.string(),
  targetConfigured: z.boolean(),
});

const broadbandRevenueOverviewSchema = z.object({
  reportYear: z.number().int(),
  previousYear: z.number().int(),
  throughMonth: z.number().int().min(1).max(12),
  hasPreviousYear: z.boolean(),
  hasComparablePreviousYear: z.boolean(),
  organization: z.object({
    groupCode: z.literal("อป."),
    groupName: z.string(),
    label: z.string(),
  }),
  service: z.object({
    businessGroup: z.literal("4.Fixed Line & Broadband"),
    serviceGroup: z.literal("4.2.กลุ่มบริการ Internet Retail"),
    label: z.literal("Internet Retail (Broadband)"),
  }),
  targetPacePercent: z.string(),
  rows: z.array(broadbandRevenueRowSchema),
  totals: comparisonMetricsSchema.extend({
    configuredTargetCount: z.number().int().nonnegative(),
    requiredTargetCount: z.number().int().positive(),
    hasAllTargets: z.boolean(),
  }),
});

export type BroadbandRevenueRow = z.infer<typeof broadbandRevenueRowSchema>;
export type BroadbandRevenueOverview = z.infer<typeof broadbandRevenueOverviewSchema>;

export async function fetchBroadbandRevenueOverview(
  year: number,
  signal?: AbortSignal
): Promise<BroadbandRevenueOverview> {
  const { data, error } = await createClient()
    .rpc("get_broadband_revenue_report", { p_year: year })
    .abortSignal(signal ?? new AbortController().signal);

  if (error) throw new Error(error.message);
  return broadbandRevenueOverviewSchema.parse(data);
}
