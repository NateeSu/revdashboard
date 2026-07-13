import type { ParsedDetailRow, RevenueRow } from "@/lib/excel/types";

export function transformDetailsToRevenueRows(
  details: readonly ParsedDetailRow[],
  monthColumns: readonly string[]
): RevenueRow[] {
  return details.flatMap((detail) =>
    monthColumns.map((period) => ({
      sourceRowNumber: detail.sourceRowNumber,
      recordKey: detail.recordKey,
      periodMonth: `${period.slice(0, 4)}-${period.slice(4, 6)}-01`,
      unitName: detail.unitName,
      sectionName: detail.sectionName,
      costCenter: detail.costCenter,
      businessGroup: detail.businessGroup,
      serviceGroup: detail.serviceGroup,
      productCode: detail.productCode,
      serviceName: detail.serviceName,
      revenueAmount: detail.monthlyAmounts[period] ?? null,
      sourceIsBlank: detail.sourceBlanks[period] ?? true,
    }))
  );
}
