import { describe, expect, it } from "vitest";

import { buildOpAreaOverviewWorkbook } from "@/lib/excel/op-area-overview-exporter";
import type { OpAreaOverview, OpAreaOverviewRow } from "@/lib/query/op-area-overview";

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
  level: OpAreaOverviewRow["level"],
  label: string,
  unitName: string | null,
  sectionName: string | null,
  parentKey: string | null
): OpAreaOverviewRow {
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

const report: OpAreaOverview = {
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

describe("OP area overview Excel export", () => {
  it("keeps the required section, department and group row order", async () => {
    const workbook = await buildOpAreaOverviewWorkbook({
      report,
      exportedAt: new Date("2026-07-17T03:00:00.000Z"),
    });
    const sheet = workbook.getWorksheet("ภาพรวม อป. รายพื้นที่");

    expect(sheet?.getCell("A1").value).toBe("ภาพรวม อป. รายพื้นที่");
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
    const reopenedSheet = reopenedWorkbook.getWorksheet("ภาพรวม อป. รายพื้นที่");
    expect(reopenedSheet?.getRow(14).getCell(1).value).toBe("รวม อป.");
  }, 15_000);
});
