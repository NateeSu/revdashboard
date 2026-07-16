import { describe, expect, it } from "vitest";

import { buildOpServiceOverviewWorkbook } from "@/lib/excel/op-service-overview-exporter";
import type { OpServiceOverview } from "@/lib/query/op-service-overview";

const report: OpServiceOverview = {
  reportYear: 2026,
  previousYear: 2025,
  throughMonth: 6,
  hasPreviousYear: true,
  hasComparablePreviousYear: true,
  organization: {
    groupCode: "อป.",
    groupName: "ภาคตะวันออก",
    label: "อป. — ภาคตะวันออก",
  },
  targetPacePercent: "50.00",
  rows: [
    {
      key: "business:hard-infrastructure",
      sortOrder: 10,
      parentKey: null,
      level: "business_group",
      businessGroup: "1.Hard Infrastructure",
      serviceGroup: null,
      label: "1. Hard Infrastructure",
      currentYtdRevenueBaht: "2660000.00",
      previousComparisonRevenueBaht: "2000000.00",
      differenceBaht: "660000.00",
      differencePercent: "33.00",
      annualTargetBaht: "12970000.00",
      expectedTargetBaht: "6485000.00",
      annualTargetPercent: "20.51",
      expectedTargetPercent: "41.02",
      expectedTargetVarianceBaht: "-3825000.00",
      targetConfigured: true,
    },
    {
      key: "service:asset-development",
      sortOrder: 11,
      parentKey: "business:hard-infrastructure",
      level: "service_group",
      businessGroup: "1.Hard Infrastructure",
      serviceGroup: "1.4.กลุ่มบริการพัฒนาสินทรัพย์",
      label: "1.4 กลุ่มบริการพัฒนาสินทรัพย์",
      currentYtdRevenueBaht: "1440000.00",
      previousComparisonRevenueBaht: "1000000.00",
      differenceBaht: "440000.00",
      differencePercent: "44.00",
      annualTargetBaht: "9640000.00",
      expectedTargetBaht: "4820000.00",
      annualTargetPercent: "14.94",
      expectedTargetPercent: "29.88",
      expectedTargetVarianceBaht: "-3380000.00",
      targetConfigured: true,
    },
    {
      key: "business:international",
      sortOrder: 20,
      parentKey: null,
      level: "business_group",
      businessGroup: "2.International",
      serviceGroup: null,
      label: "2. International",
      currentYtdRevenueBaht: "470000.00",
      previousComparisonRevenueBaht: "500000.00",
      differenceBaht: "-30000.00",
      differencePercent: "-6.00",
      annualTargetBaht: null,
      expectedTargetBaht: null,
      annualTargetPercent: null,
      expectedTargetPercent: null,
      expectedTargetVarianceBaht: null,
      targetConfigured: false,
    },
  ],
  totals: {
    currentYtdRevenueBaht: "3130000.00",
    previousComparisonRevenueBaht: "2500000.00",
    differenceBaht: "630000.00",
    differencePercent: "25.20",
    annualTargetBaht: "12970000.00",
    expectedTargetBaht: "6485000.00",
    annualTargetPercent: "24.13",
    expectedTargetPercent: "48.27",
    expectedTargetVarianceBaht: "-3355000.00",
    configuredTargetCount: 1,
    requiredTargetCount: 6,
    hasAllBusinessGroupTargets: false,
  },
};

describe("OP service overview Excel export", () => {
  it("exports hierarchy, sparse targets and totals without double-counting service rows", async () => {
    const workbook = await buildOpServiceOverviewWorkbook({
      report,
      exportedAt: new Date("2026-07-16T03:00:00.000Z"),
    });
    const sheet = workbook.getWorksheet("ภาพรวม อป. รายบริการ");

    expect(sheet).toBeDefined();
    expect(sheet?.getCell("A1").value).toBe("ภาพรวม อป. รายบริการ");
    expect(sheet?.getCell("B3").value).toBe("พ.ศ. 2569");
    expect(sheet?.getCell("B4").value).toBe("มกราคม–มิถุนายน พ.ศ. 2569");
    expect(sheet?.getRow(9).getCell(1).value).toBe("1. Hard Infrastructure");
    expect(sheet?.getRow(10).getCell(1).value).toBe("    1.4 กลุ่มบริการพัฒนาสินทรัพย์");
    expect(sheet?.getRow(11).getCell(6).value).toBeNull();
    expect(sheet?.getRow(12).getCell(2).value).toEqual({
      formula: "SUM(B9,B11)",
      result: 3.13,
    });
    expect(sheet?.getRow(12).getCell(6).value).toEqual({
      formula: "SUM(F9,F11)",
      result: 12.97,
    });
    expect(sheet?.views).toEqual([{ state: "frozen", xSplit: 1, ySplit: 8, showGridLines: false }]);

    const buffer = await workbook.xlsx.writeBuffer();
    const ExcelJSModule = await import("exceljs");
    const ExcelJS = ExcelJSModule.default ?? ExcelJSModule;
    const reopenedWorkbook = new ExcelJS.Workbook();
    await reopenedWorkbook.xlsx.load(buffer);
    const reopenedSheet = reopenedWorkbook.getWorksheet("ภาพรวม อป. รายบริการ");

    expect(reopenedSheet?.getCell("A1").value).toBe("ภาพรวม อป. รายบริการ");
    expect(reopenedSheet?.getRow(12).getCell(2).value).toEqual({
      formula: "SUM(B9,B11)",
      result: 3.13,
    });
  }, 15_000);
});
