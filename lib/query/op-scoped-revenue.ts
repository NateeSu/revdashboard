import { z } from "zod";

import { createClient } from "@/lib/supabase/client";
import {
  getOpScopedReportConfig,
  OP_REVENUE_SCOPE_KEYS,
  type OpRevenueScopeKey,
} from "@/lib/revenue/op-scoped-report-config";

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

const opScopedRevenueRowSchema = comparisonMetricsSchema.extend({
  key: z.string(),
  sortOrder: z.number().int(),
  parentKey: z.string().nullable(),
  level: z.enum(["group", "department", "section"]),
  unitName: z.enum(["อป.1", "อป.2"]).nullable(),
  sectionName: z.string().nullable(),
  label: z.string(),
  targetConfigured: z.boolean(),
});

const opScopedRevenueOverviewSchema = z.object({
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
  scope: z.object({
    key: z.enum(OP_REVENUE_SCOPE_KEYS),
    level: z.enum(["business_group", "service_group"]),
    businessGroup: z.string(),
    serviceGroup: z.string().nullable(),
    label: z.string(),
    reportTitle: z.string(),
  }),
  targetPacePercent: z.string(),
  rows: z.array(opScopedRevenueRowSchema).length(14),
  totals: comparisonMetricsSchema.extend({
    configuredTargetCount: z.number().int().nonnegative(),
    requiredTargetCount: z.literal(14),
    hasAllTargets: z.boolean(),
  }),
});

export type OpScopedRevenueRow = z.infer<typeof opScopedRevenueRowSchema>;
export type OpScopedRevenueOverview = z.infer<typeof opScopedRevenueOverviewSchema>;

export async function fetchOpScopedRevenueOverview(
  scopeKey: OpRevenueScopeKey,
  year: number,
  signal?: AbortSignal
): Promise<OpScopedRevenueOverview> {
  const { data, error } = await createClient()
    .rpc("get_op_scoped_revenue_report", { p_year: year, p_scope_key: scopeKey })
    .abortSignal(signal ?? new AbortController().signal);

  if (error) throw new Error(error.message);

  const report = opScopedRevenueOverviewSchema.parse(data);
  const config = getOpScopedReportConfig(scopeKey);
  if (
    report.scope.key !== config.key ||
    report.scope.level !== config.scopeLevel ||
    report.scope.businessGroup !== config.businessGroup ||
    report.scope.serviceGroup !== config.serviceGroup
  ) {
    throw new Error("REPORT_SCOPE_MISMATCH");
  }

  return report;
}
