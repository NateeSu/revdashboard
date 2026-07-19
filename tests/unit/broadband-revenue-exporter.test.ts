import { describe, expect, it } from "vitest";

import { buildBroadbandRevenueWorkbook } from "@/lib/excel/broadband-revenue-exporter";
import type { BroadbandRevenueOverview, BroadbandRevenueRow } from "@/lib/query/broadband-revenue";

const metrics = {
  currentYtdRevenueBaht: "1000000.00",
  previousComparisonRevenueBaht: "900000.00",
  differenceBaht: "100000.00",
  differencePercent: "11.11",
  annualTargetBaht: "3000000.00",
  expectedTargetBaht: "1000000.00",
  annualTargetPercent: "33.33",
  expectedTargetPercent: "100.00",
  expectedTargetVarianceBaht: "0.00",
};

function row(
  key: string,
  sortOrder: number,
  level: BroadbandRevenueRow["level"],
  label: string,
  unitName: BroadbandRevenueRow["unitName"],
  sectionName: string | null,
  parentKey: string | null
): BroadbandRevenueRow {
  return {
    key,
    sortOrder,
    level,
    label,
    unitName,
    sectionName,
    parentKey,
    targetConfigured: true,
    ...metrics,
  };
}

const report: BroadbandRevenueOverview = {
  reportYear: 2026,
  previousYear: 2025,
  throughMonth: 4,
  hasPreviousYear: true,
  hasComparablePreviousYear: true,
  organization: {
    groupCode: "อป.",
    groupName: "ภาคตะวันออก",
    label: "อป. — ภาคตะวันออก",
  },
  scope: {
    key: "broadband",
    level: "service_group",
    businessGroup: "4.Fixed Line & Broadband",
    serviceGroup: "4.2.กลุ่มบริการ Internet Retail",
    label: "Internet Retail (Broadband)",
    reportTitle: "รายได้ Broadband",
  },
  targetPacePercent: "33.33",
  rows: [
    row(
      "section:chanthaburi",
      10,
      "section",
      "จันทบุรี",
      "อป.1",
      "ส่วนขายและบริการลูกค้า จันทบุรี",
      "department:op1"
    ),
    row(
      "section:trat",
      11,
      "section",
      "ตราด",
      "อป.1",
      "ส่วนขายและบริการลูกค้า ตราด",
      "department:op1"
    ),
    row("department:op1", 15, "department", "อป.1", "อป.1", null, "group:op"),
    row(
      "section:rayong",
      25,
      "section",
      "ระยอง",
      "อป.2",
      "ส่วนขายและบริการลูกค้า ระยอง",
      "department:op2"
    ),
    row("department:op2", 26, "department", "อป.2", "อป.2", null, "group:op"),
    row("group:op", 30, "group", "อป.", null, null, null),
  ],
  totals: {
    ...metrics,
    configuredTargetCount: 14,
    requiredTargetCount: 14,
    hasAllTargets: true,
  },
};

describe("Broadband revenue Excel export", () => {
  it("keeps the required section, department and group row order", async () => {
    const workbook = await buildBroadbandRevenueWorkbook({
      report,
      exportedAt: new Date("2026-07-17T03:00:00.000Z"),
    });
    const sheet = workbook.getWorksheet("รายได้ Broadband");

    expect(sheet?.getCell("A1").value).toBe("รายได้ Broadband");
    expect(sheet?.getCell("B3").value).toBe("พ.ศ. 2569");
    expect(sheet?.getRow(9).getCell(1).value).toBe("จันทบุรี");
    expect(sheet?.getRow(11).getCell(1).value).toBe("รวม อป.1");
    expect(sheet?.getRow(12).getCell(1).value).toBe("ระยอง");
    expect(sheet?.getRow(14).getCell(1).value).toBe("รวม อป.");
    expect(sheet?.getRow(12).getCell(6).value).toBe(3);
    expect(sheet?.views).toEqual([{ state: "frozen", xSplit: 1, ySplit: 8, showGridLines: false }]);

    const buffer = await workbook.xlsx.writeBuffer();
    const ExcelJSModule = await import("exceljs");
    const ExcelJS = ExcelJSModule.default ?? ExcelJSModule;
    const reopenedWorkbook = new ExcelJS.Workbook();
    await reopenedWorkbook.xlsx.load(buffer);
    const reopenedSheet = reopenedWorkbook.getWorksheet("รายได้ Broadband");
    expect(reopenedSheet?.getRow(14).getCell(1).value).toBe("รวม อป.");
  }, 15_000);

  it.each([
    {
      key: "datacom" as const,
      level: "service_group" as const,
      businessGroup: "4.Fixed Line & Broadband",
      serviceGroup: "4.3.กลุ่มบริการวงจรเช่า (Datacom)",
      label: "กลุ่มบริการวงจรเช่า (Datacom)",
      reportTitle: "รายได้ Datacom",
    },
    {
      key: "ict-solution" as const,
      level: "business_group" as const,
      businessGroup: "6.ICT Solution",
      serviceGroup: null,
      label: "กลุ่มธุรกิจ ICT Solution",
      reportTitle: "รายได้ ICT-Solution",
    },
  ])("creates the correctly named and colored workbook for $key", async (scope) => {
    const workbook = await buildBroadbandRevenueWorkbook({
      report: { ...report, scope },
      exportedAt: new Date("2026-07-17T03:00:00.000Z"),
    });
    const sheet = workbook.getWorksheet(scope.reportTitle);

    expect(sheet?.getCell("A1").value).toBe(scope.reportTitle);
    expect(sheet?.getCell("A2").value).toContain(scope.label);
    expect(sheet?.getCell("A1").fill).toMatchObject({ type: "pattern", pattern: "solid" });

    const buffer = await workbook.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(1_000);
  });
});
