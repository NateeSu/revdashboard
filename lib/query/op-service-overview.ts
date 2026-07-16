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

const opServiceOverviewRowSchema = comparisonMetricsSchema.extend({
  key: z.string(),
  sortOrder: z.number().int(),
  parentKey: z.string().nullable(),
  level: z.enum(["business_group", "service_group"]),
  businessGroup: z.string(),
  serviceGroup: z.string().nullable(),
  label: z.string(),
  targetConfigured: z.boolean(),
});

const opServiceOverviewSchema = z.object({
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
  targetPacePercent: z.string(),
  rows: z.array(opServiceOverviewRowSchema),
  totals: comparisonMetricsSchema.extend({
    configuredTargetCount: z.number().int().nonnegative(),
    requiredTargetCount: z.number().int().positive(),
    hasAllBusinessGroupTargets: z.boolean(),
  }),
});

export type OpServiceOverviewRow = z.infer<typeof opServiceOverviewRowSchema>;
export type OpServiceOverview = z.infer<typeof opServiceOverviewSchema>;

export async function fetchOpServiceOverview(
  year: number,
  signal?: AbortSignal
): Promise<OpServiceOverview> {
  const { data, error } = await createClient()
    .rpc("get_op_service_overview_report", { p_year: year })
    .abortSignal(signal ?? new AbortController().signal);

  if (error) throw new Error(error.message);
  return opServiceOverviewSchema.parse(data);
}
