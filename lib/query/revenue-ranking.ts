import { z } from "zod";

import { createClient } from "@/lib/supabase/client";
import { REVENUE_RANKING_GROUPS, type RevenueRankingGroupKey } from "@/lib/revenue/ranking-groups";

const nullableMoneySchema = z.string().nullable();

const sourceRowSchema = z.object({
  key: z.string(),
  level: z.enum(["group", "department", "section"]),
  unitName: z.string().nullable(),
  sectionName: z.string().nullable(),
  currentYtdRevenueBaht: z.string(),
  previousComparisonRevenueBaht: nullableMoneySchema,
  differenceBaht: nullableMoneySchema,
  differencePercent: nullableMoneySchema,
});

const sourceReportSchema = z.object({
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
  rows: z.array(sourceRowSchema),
});

export type RevenueRankingRow = {
  key: string;
  groupKey: RevenueRankingGroupKey;
  unitName: string;
  sectionName: string;
  label: string;
  currentYtdRevenueBaht: string;
  previousComparisonRevenueBaht: string | null;
  differenceBaht: string | null;
  differencePercent: string | null;
  rank: number;
};

export type RevenueRankingGroup = {
  key: RevenueRankingGroupKey;
  label: string;
  tier: "L" | "M" | "S";
  rows: RevenueRankingRow[];
};

export type RevenueRankingReport = {
  reportYear: number;
  previousYear: number;
  throughMonth: number;
  hasPreviousYear: boolean;
  hasComparablePreviousYear: boolean;
  organization: {
    groupCode: "อป.";
    groupName: string;
    label: string;
  };
  groups: RevenueRankingGroup[];
  totals: {
    currentYtdRevenueBaht: string;
    previousComparisonRevenueBaht: string | null;
    differenceBaht: string | null;
    differencePercent: string | null;
  };
};

export function buildRevenueRankingReport(data: unknown): RevenueRankingReport {
  const source = sourceReportSchema.parse(data);
  const sourceBySection = new Map(
    source.rows
      .filter((row) => row.level === "section" && row.sectionName)
      .map((row) => [row.sectionName as string, row])
  );
  const totalRow = source.rows.find((row) => row.level === "group");

  if (!totalRow) throw new Error("RANKING_TOTAL_NOT_FOUND");

  const groups = REVENUE_RANKING_GROUPS.map((group) => {
    const rows = group.areas.map((area) => {
      const sourceRow = sourceBySection.get(area.sectionName);
      if (!sourceRow) throw new Error(`RANKING_AREA_NOT_FOUND:${area.sectionName}`);
      return { area, sourceRow };
    });

    rows.sort(
      (left, right) =>
        Number(right.sourceRow.currentYtdRevenueBaht) -
          Number(left.sourceRow.currentYtdRevenueBaht) ||
        left.area.referenceOrder - right.area.referenceOrder
    );

    return {
      key: group.key,
      label: group.label,
      tier: group.tier,
      rows: rows.map(({ area, sourceRow }, index) => ({
        key: area.key,
        groupKey: group.key,
        unitName: area.unitName,
        sectionName: area.sectionName,
        label: area.label,
        currentYtdRevenueBaht: sourceRow.currentYtdRevenueBaht,
        previousComparisonRevenueBaht: sourceRow.previousComparisonRevenueBaht,
        differenceBaht: sourceRow.differenceBaht,
        differencePercent: sourceRow.differencePercent,
        rank: index + 1,
      })),
    } satisfies RevenueRankingGroup;
  });

  return {
    reportYear: source.reportYear,
    previousYear: source.previousYear,
    throughMonth: source.throughMonth,
    hasPreviousYear: source.hasPreviousYear,
    hasComparablePreviousYear: source.hasComparablePreviousYear,
    organization: source.organization,
    groups,
    totals: {
      currentYtdRevenueBaht: totalRow.currentYtdRevenueBaht,
      previousComparisonRevenueBaht: totalRow.previousComparisonRevenueBaht,
      differenceBaht: totalRow.differenceBaht,
      differencePercent: totalRow.differencePercent,
    },
  };
}

export async function fetchRevenueRanking(
  year: number,
  signal?: AbortSignal
): Promise<RevenueRankingReport> {
  const { data, error } = await createClient()
    .rpc("get_op_area_overview_report", { p_year: year })
    .abortSignal(signal ?? new AbortController().signal);

  if (error) throw new Error(error.message);
  return buildRevenueRankingReport(data);
}
