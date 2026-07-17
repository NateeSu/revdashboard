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

const opAreaOverviewRowSchema = comparisonMetricsSchema.extend({
  key: z.string(),
  sortOrder: z.number().int(),
  parentKey: z.string().nullable(),
  level: z.enum(["group", "department", "section"]),
  unitName: z.string().nullable(),
  sectionName: z.string().nullable(),
  label: z.string(),
  targetConfigured: z.boolean(),
});

const opAreaOverviewSchema = z.object({
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
  rows: z.array(opAreaOverviewRowSchema),
  totals: comparisonMetricsSchema.extend({
    configuredTargetCount: z.number().int().nonnegative(),
    requiredTargetCount: z.number().int().positive(),
    hasAllTargets: z.boolean(),
  }),
});

export type OpAreaOverviewRow = z.infer<typeof opAreaOverviewRowSchema>;
export type OpAreaOverview = z.infer<typeof opAreaOverviewSchema>;

export async function fetchOpAreaOverview(
  year: number,
  signal?: AbortSignal
): Promise<OpAreaOverview> {
  const { data, error } = await createClient()
    .rpc("get_op_area_overview_report", { p_year: year })
    .abortSignal(signal ?? new AbortController().signal);

  if (error) throw new Error(error.message);
  return opAreaOverviewSchema.parse(data);
}
