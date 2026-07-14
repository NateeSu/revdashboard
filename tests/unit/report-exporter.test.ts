import { describe, expect, it } from "vitest";

import { buildRevenueMatrixWorkbook } from "@/lib/excel/report-exporter";
import type { RevenueMatrixReport } from "@/lib/query/reports";

const report: RevenueMatrixReport = {
  reportYear: 2025,
  throughMonth: 2,
  months: ["202501", "202502"],
  rows: [
    {
      sectionName: "ส่วนงาน 1",
      monthlyRevenue: { "202501": "100.25", "202502": "200.50" },
      ytdRevenue: "300.75",
    },
    {
      sectionName: "ส่วนงาน 2",
      monthlyRevenue: { "202501": "50.00", "202502": "75.00" },
      ytdRevenue: "125.00",
    },
  ],
  totals: {
    monthlyRevenue: { "202501": "150.25", "202502": "275.50" },
    ytdRevenue: "425.75",
  },
};

describe("revenue matrix Excel export", () => {
  it("exports the visible period, filter values, rows, formulas and totals", async () => {
    const workbook = await buildRevenueMatrixWorkbook({
      report,
      filters: {
        businessGroups: ["กลุ่มธุรกิจ A"],
        sectionNames: ["ส่วนงาน 1", "ส่วนงาน 2"],
      },
      exportedAt: new Date("2026-07-14T03:00:00.000Z"),
    });
    const sheet = workbook.getWorksheet("รายงานรายได้");

    expect(sheet).toBeDefined();
    expect(sheet?.getCell("A1").value).toBe("รายงานรายได้รายเดือน");
    expect(sheet?.getCell("B3").value).toBe("พ.ศ. 2568");
    expect(sheet?.getCell("B4").value).toBe("มกราคม–กุมภาพันธ์ พ.ศ. 2568");
    expect(sheet?.getCell("B8").value).toBe("กลุ่มธุรกิจ A");
    expect(sheet?.getCell("B12").value).toBe("ส่วนงาน 1\nส่วนงาน 2");

    expect(sheet?.getRow(17).values).toEqual([
      undefined,
      "ส่วนงาน",
      "202501",
      "202502",
      "รายได้สะสม",
    ]);
    expect(sheet?.getRow(18).getCell(2).value).toBe(100.25);
    expect(sheet?.getRow(18).getCell(4).value).toEqual({
      formula: "SUM(B18:C18)",
      result: 300.75,
    });
    expect(sheet?.getRow(20).getCell(2).value).toEqual({
      formula: "SUM(B18:B19)",
      result: 150.25,
    });
    expect(sheet?.getRow(20).getCell(4).value).toEqual({
      formula: "SUM(D18:D19)",
      result: 425.75,
    });
    expect(sheet?.views).toEqual([{ showGridLines: false }]);
  }, 15_000);
});
