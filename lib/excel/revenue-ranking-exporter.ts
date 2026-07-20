import type { RevenueRankingReport } from "@/lib/query/revenue-ranking";
import type { RevenueRankingGroupKey } from "@/lib/revenue/ranking-groups";
import { formatBuddhistYear, formatThaiMonthName } from "@/lib/revenue/reporting-period";

export type RevenueRankingExportInput = {
  report: RevenueRankingReport;
  exportedAt?: Date;
};

const moneyFormat = "#,##0.00;[Red]-#,##0.00";
const percentFormat = "0.00%;[Red]-0.00%";

const excelGroupColors: Record<
  RevenueRankingGroupKey,
  { group: string; area: string; border: string }
> = {
  "super-demander": { group: "FFFFE7A3", area: "FFFFF6DA", border: "FFD19A00" },
  "star-champion": { group: "FFD1D5DB", area: "FFF3F4F6", border: "FF4B5563" },
  "rising-star": { group: "FFFEF3C7", area: "FFFFFBEB", border: "FFEAB308" },
};

function millionBaht(value: string | null): number | null {
  return value === null ? null : Number(value) / 1_000_000;
}

function percentage(value: string | null): number | null {
  return value === null ? null : Number(value) / 100;
}

function exportTimestamp(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}${get("month")}${get("day")}_${get("hour")}${get("minute")}${get("second")}`;
}

export async function buildRevenueRankingWorkbook(input: RevenueRankingExportInput) {
  const ExcelJSModule = await import("exceljs");
  const ExcelJS = ExcelJSModule.default ?? ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  const exportedAt = input.exportedAt ?? new Date();
  const { report } = input;
  const monthName = formatThaiMonthName(report.reportYear, report.throughMonth);
  const buddhistYear = formatBuddhistYear(report.reportYear);

  workbook.creator = "Revenue Dashboard";
  workbook.created = exportedAt;
  workbook.modified = exportedAt;
  workbook.subject = `รายงาน Ranking พื้นที่ อป. ${buddhistYear}`;

  const sheet = workbook.addWorksheet("รายงาน Ranking", {
    properties: { defaultRowHeight: 22 },
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: { left: 0.2, right: 0.2, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
    },
  });
  sheet.views = [{ state: "frozen", xSplit: 2, ySplit: 7, showGridLines: false }];

  sheet.mergeCells("A1:G1");
  const title = sheet.getCell("A1");
  title.value = `จัดอันดับรายได้ปี ${buddhistYear.replace("พ.ศ. ", "")}`;
  title.font = { name: "Aptos Display", size: 20, bold: true, color: { argb: "FF111827" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE68A" } };
  title.alignment = { vertical: "middle", horizontal: "center" };
  sheet.getRow(1).height = 38;

  sheet.mergeCells("A2:G2");
  const subtitle = sheet.getCell("A2");
  subtitle.value = `${report.organization.label} · มกราคม–${monthName} ${buddhistYear}`;
  subtitle.font = { name: "Aptos", size: 11, color: { argb: "FF334155" } };
  subtitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
  subtitle.alignment = { vertical: "middle", horizontal: "center" };

  const metadata: Array<[string, string | Date]> = [
    ["ช่วงเปรียบเทียบ", `มกราคม–${monthName} ${formatBuddhistYear(report.previousYear)}`],
    ["หลักการจัดอันดับ", "เรียงรายได้สะสมปีปัจจุบันจากมากไปน้อยภายในกลุ่มเดียวกัน"],
    ["วันที่เวลา Export", exportedAt],
  ];
  metadata.forEach(([label, value], index) => {
    const rowNumber = index + 3;
    sheet.getCell(rowNumber, 1).value = label;
    sheet.mergeCells(rowNumber, 2, rowNumber, 7);
    sheet.getCell(rowNumber, 2).value = value;
    sheet.getCell(rowNumber, 1).font = { bold: true, color: { argb: "FF374151" } };
    sheet.getCell(rowNumber, 1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEF3C7" },
    };
    if (value instanceof Date) sheet.getCell(rowNumber, 2).numFmt = "dd/mm/yyyy hh:mm:ss";
  });

  const headerRowNumber = 7;
  const header = sheet.getRow(headerRowNumber);
  header.values = [
    "ชื่อกลุ่ม",
    "พื้นที่",
    `รายได้สะสม ${buddhistYear} (ล้านบาท)`,
    `ช่วงเดียวกัน ${formatBuddhistYear(report.previousYear)} (ล้านบาท)`,
    "ส่วนต่าง (ล้านบาท)",
    "เปลี่ยนแปลง (%)",
    "อันดับในกลุ่ม",
  ];
  header.height = 42;
  header.eachCell((cell, column) => {
    const amberColumn = [3, 5, 7].includes(column);
    cell.font = {
      name: "Aptos",
      bold: true,
      color: { argb: amberColumn ? "FF111827" : "FFFFFFFF" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: amberColumn ? "FFF2C94C" : "FF374151" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: "FF111827" } } };
  });

  let rowNumber = headerRowNumber + 1;
  for (const group of report.groups) {
    const groupStartRow = rowNumber;
    const colors = excelGroupColors[group.key];

    for (const rankingRow of group.rows) {
      const row = sheet.getRow(rowNumber);
      row.values = [
        null,
        rankingRow.label,
        millionBaht(rankingRow.currentYtdRevenueBaht),
        millionBaht(rankingRow.previousComparisonRevenueBaht),
        millionBaht(rankingRow.differenceBaht),
        percentage(rankingRow.differencePercent),
        rankingRow.rank,
      ];
      row.height = 27;
      row.getCell(2).font = { bold: true, color: { argb: "FF111827" } };
      row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.area } };
      for (let column = 3; column <= 5; column += 1) row.getCell(column).numFmt = moneyFormat;
      row.getCell(6).numFmt = percentFormat;
      row.getCell(7).font = { bold: true, color: { argb: "FF111827" } };
      row.eachCell((cell, column) => {
        cell.alignment = {
          vertical: "middle",
          horizontal: column >= 3 && column <= 6 ? "right" : "center",
        };
        cell.border = { bottom: { style: "hair", color: { argb: "FFCBD5E1" } } };
      });
      if (rowNumber === groupStartRow) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "medium", color: { argb: colors.border } },
            bottom: { style: "hair", color: { argb: "FFCBD5E1" } },
          };
        });
      }
      rowNumber += 1;
    }

    const groupEndRow = rowNumber - 1;
    sheet.mergeCells(groupStartRow, 1, groupEndRow, 1);
    const groupCell = sheet.getCell(groupStartRow, 1);
    groupCell.value = `${group.label} (${group.tier})`;
    groupCell.font = { name: "Aptos", size: 13, bold: true, color: { argb: "FF111827" } };
    groupCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.group } };
    groupCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    groupCell.border = {
      top: { style: "medium", color: { argb: colors.border } },
      right: { style: "medium", color: { argb: "FF64748B" } },
      bottom: { style: "medium", color: { argb: colors.border } },
    };
  }

  const totalRow = sheet.getRow(rowNumber);
  totalRow.values = [
    "รวม อป.",
    null,
    millionBaht(report.totals.currentYtdRevenueBaht),
    millionBaht(report.totals.previousComparisonRevenueBaht),
    millionBaht(report.totals.differenceBaht),
    percentage(report.totals.differencePercent),
    null,
  ];
  sheet.mergeCells(rowNumber, 1, rowNumber, 2);
  totalRow.height = 30;
  totalRow.eachCell((cell, column) => {
    cell.font = { bold: true, color: { argb: "FF111827" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2C94C" } };
    cell.alignment = {
      vertical: "middle",
      horizontal: column >= 3 && column <= 6 ? "right" : "center",
    };
    cell.border = { top: { style: "double", color: { argb: "FF111827" } } };
  });
  for (let column = 3; column <= 5; column += 1) totalRow.getCell(column).numFmt = moneyFormat;
  totalRow.getCell(6).numFmt = percentFormat;

  sheet.getColumn(1).width = 27;
  sheet.getColumn(2).width = 25;
  for (let column = 3; column <= 5; column += 1) sheet.getColumn(column).width = 23;
  sheet.getColumn(6).width = 18;
  sheet.getColumn(7).width = 16;
  sheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: rowNumber - 1, column: 7 },
  };
  sheet.pageSetup.printArea = `A1:G${rowNumber}`;
  sheet.headerFooter.oddFooter = `รายงาน Ranking พื้นที่ อป. ${buddhistYear} · หน้า &P / &N`;

  return workbook;
}

export async function downloadRevenueRankingWorkbook(input: RevenueRankingExportInput) {
  const exportedAt = input.exportedAt ?? new Date();
  const workbook = await buildRevenueRankingWorkbook({ ...input, exportedAt });
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const filename = `รายงาน_Ranking_พื้นที่_อป_พศ${input.report.reportYear + 543}_ถึงเดือน${String(input.report.throughMonth).padStart(2, "0")}_${exportTimestamp(exportedAt)}.xlsx`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return filename;
}
