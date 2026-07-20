import { describe, expect, it } from "vitest";

import { buildRevenueRankingWorkbook } from "@/lib/excel/revenue-ranking-exporter";
import { buildRevenueRankingReport } from "@/lib/query/revenue-ranking";
import { createRevenueRankingSourceReport } from "@/tests/fixtures/revenue-ranking-source";

describe("revenue ranking Excel export", () => {
  it("preserves grouped rows, numeric values, rankings and merged group labels", async () => {
    const report = buildRevenueRankingReport(createRevenueRankingSourceReport());
    const workbook = await buildRevenueRankingWorkbook({
      report,
      exportedAt: new Date("2026-07-20T03:00:00.000Z"),
    });
    const sheet = workbook.getWorksheet("รายงาน Ranking");

    expect(sheet?.getCell("A1").value).toBe("จัดอันดับรายได้ปี 2569");
    expect(sheet?.getCell("A8").value).toBe("Super Demander (L)");
    expect(sheet?.getCell("B8").value).toBe("ระยอง");
    expect(sheet?.getCell("C8").value).toBeCloseTo(52.32152729, 8);
    expect(sheet?.getCell("G8").value).toBe(1);
    expect(sheet?.getCell("A12").value).toBe("Star Champion (M)");
    expect(sheet?.getCell("A16").value).toBe("Rising Star (S)");
    expect(sheet?.getCell("A19").value).toBe("รวม อป.");
    expect(sheet?.getCell("A8").isMerged).toBe(true);
    expect(sheet?.getCell("A19").isMerged).toBe(true);
    expect(sheet?.views).toEqual([{ state: "frozen", xSplit: 2, ySplit: 7, showGridLines: false }]);

    const buffer = await workbook.xlsx.writeBuffer();
    const ExcelJSModule = await import("exceljs");
    const ExcelJS = ExcelJSModule.default ?? ExcelJSModule;
    const reopenedWorkbook = new ExcelJS.Workbook();
    await reopenedWorkbook.xlsx.load(buffer);
    const reopenedSheet = reopenedWorkbook.getWorksheet("รายงาน Ranking");
    expect(reopenedSheet?.getCell("B8").value).toBe("ระยอง");
    expect(reopenedSheet?.getCell("G18").value).toBe(3);
  }, 15_000);
});
