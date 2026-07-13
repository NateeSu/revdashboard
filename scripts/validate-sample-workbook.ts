import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { parseRevenueWorkbook } from "@/lib/excel/parser";

type Check = { name: string; expected: string | number; actual: string | number };

async function main() {
  const inputPath = path.resolve(process.argv[2] ?? "./revenue_report_202605.xlsx");
  try {
    const info = await stat(inputPath);
    if (!info.isFile()) throw new Error("path is not a file");
  } catch {
    throw new Error(
      `ไม่พบไฟล์ตัวอย่างที่ ${inputPath} กรุณาวาง revenue_report_202605.xlsx ไว้ที่ project root`
    );
  }

  const bytes = await readFile(inputPath);
  const data = Uint8Array.from(bytes).buffer;
  const result = await parseRevenueWorkbook(data, { filename: path.basename(inputPath) });
  const { summary, dimensionCounts, monthlyTotals } = result;
  const totals = Object.fromEntries(monthlyTotals.map((item) => [item.period, item.revenue]));
  const errorCount = summary.issues.filter((issue) => issue.severity === "error").length;

  const checks: Check[] = [
    { name: "Sheet", expected: "Report_รายเดือน", actual: summary.sheetName },
    { name: "Header row", expected: 7, actual: summary.headerRow },
    { name: "Source rows", expected: 2743, actual: summary.sourceRowCount },
    { name: "Detail rows", expected: 1728, actual: summary.detailRowCount },
    { name: "Generated revenue rows", expected: 8640, actual: summary.generatedRevenueRowCount },
    { name: "Service Group Total", expected: 631, actual: summary.serviceGroupTotalCount },
    { name: "Business Group Total", expected: 314, actual: summary.businessGroupTotalCount },
    { name: "Section Total", expected: 52, actual: summary.sectionTotalCount },
    { name: "Unit Total", expected: 6, actual: summary.unitTotalCount },
    { name: "Grand Total", expected: 1, actual: summary.grandTotalCount },
    { name: "Blank/note rows", expected: 11, actual: summary.ignoredNoteOrBlankCount },
    { name: "Units", expected: 6, actual: dimensionCounts.units },
    { name: "Sections", expected: 52, actual: dimensionCounts.sections },
    { name: "Cost Centers", expected: 52, actual: dimensionCounts.costCenters },
    { name: "Business Groups", expected: 7, actual: dimensionCounts.businessGroups },
    { name: "Service Groups", expected: 22, actual: dimensionCounts.serviceGroups },
    { name: "Products", expected: 88, actual: dimensionCounts.products },
    { name: "Services", expected: 88, actual: dimensionCounts.services },
    { name: "Duplicate detail keys", expected: 0, actual: summary.duplicateDetailKeyCount },
    { name: "Blank month cells", expected: 809, actual: summary.blankRevenueCellCount },
    { name: "Negative month cells", expected: 113, actual: summary.negativeRevenueCellCount },
    { name: "Zero month cells", expected: 48, actual: summary.zeroRevenueCellCount },
    { name: "Row total mismatches", expected: 0, actual: summary.rowTotalMismatchCount },
    { name: "Validation errors", expected: 0, actual: errorCount },
    { name: "202601", expected: "607307549.20", actual: totals["202601"] },
    { name: "202602", expected: "601083811.79", actual: totals["202602"] },
    { name: "202603", expected: "601056309.54", actual: totals["202603"] },
    { name: "202604", expected: "598622033.25", actual: totals["202604"] },
    { name: "202605", expected: "611340019.97", actual: totals["202605"] },
    { name: "YTD", expected: "3019409723.75", actual: summary.ytdRevenue },
  ];

  const rows = checks.map((check) => ({
    Test: check.name,
    Expected: String(check.expected),
    Actual: String(check.actual),
    Result: String(check.expected) === String(check.actual) ? "PASS" : "FAIL",
  }));
  console.table(rows);

  const failures = rows.filter((row) => row.Result === "FAIL");
  if (failures.length > 0) {
    console.error(`Sample acceptance ไม่ผ่าน ${failures.length} รายการ`);
    process.exitCode = 1;
    return;
  }
  console.log("Sample acceptance ผ่านครบทุกตัวเลข โดยใช้ production parser/validator");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "ไม่สามารถตรวจไฟล์ตัวอย่างได้");
  process.exitCode = 1;
});
