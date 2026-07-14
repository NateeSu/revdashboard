import type { RevenueMatrixReport } from "@/lib/query/reports";
import { formatBuddhistYear } from "@/lib/revenue/reporting-period";
import { formatReportPeriodRange, getReportFilterDetails } from "@/lib/revenue/report-scope";
import type { RevenueFilters } from "@/lib/revenue/types";

export type RevenueMatrixExportInput = {
  report: RevenueMatrixReport;
  filters: RevenueFilters;
  exportedAt?: Date;
};

const moneyFormat = "#,##0.00;[Red]-#,##0.00";

function columnName(index: number): string {
  let name = "";
  let value = index;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
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

export async function buildRevenueMatrixWorkbook(input: RevenueMatrixExportInput) {
  const ExcelJSModule = await import("exceljs");
  const ExcelJS = ExcelJSModule.default ?? ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  const exportedAt = input.exportedAt ?? new Date();
  const { report } = input;
  const filterDetails = getReportFilterDetails(input.filters);
  const activeFilters = filterDetails.filter((detail) => detail.values.length > 0);
  const columnCount = report.months.length + 2;
  const lastColumn = columnName(columnCount);

  workbook.creator = "Revenue Dashboard";
  workbook.created = exportedAt;
  workbook.modified = exportedAt;
  workbook.subject = `รายงานรายได้ ${formatBuddhistYear(report.reportYear)}`;

  const sheet = workbook.addWorksheet("รายงานรายได้", {
    properties: { defaultRowHeight: 20 },
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });
  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 0, showGridLines: false }];

  sheet.mergeCells(`A1:${lastColumn}1`);
  const titleCell = sheet.getCell("A1");
  titleCell.value = "รายงานรายได้รายเดือน";
  titleCell.font = { name: "Aptos Display", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 34;

  sheet.mergeCells(`A2:${lastColumn}2`);
  const subtitleCell = sheet.getCell("A2");
  subtitleCell.value = `รายได้แยกตามส่วนงาน · ${formatReportPeriodRange(report.reportYear, report.throughMonth)}`;
  subtitleCell.font = { name: "Aptos", size: 11, color: { argb: "FF334155" } };
  subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
  subtitleCell.alignment = { vertical: "middle" };
  sheet.getRow(2).height = 25;

  const metadataRows: Array<[string, string | number | Date]> = [
    ["ปีที่แสดง", formatBuddhistYear(report.reportYear)],
    ["ช่วงข้อมูล", formatReportPeriodRange(report.reportYear, report.throughMonth)],
    ["รูปแบบรายงาน", "รายเดือน แยกตามส่วนงาน พร้อมรายได้สะสม"],
    ["จำนวนส่วนงาน", report.rows.length],
    ["วันที่เวลา Export", exportedAt],
  ];
  for (const detail of filterDetails) {
    metadataRows.push([detail.label, detail.values.length ? detail.values.join("\n") : "ทั้งหมด"]);
  }

  let rowNumber = 3;
  for (const [label, value] of metadataRows) {
    const row = sheet.getRow(rowNumber);
    row.getCell(1).value = label;
    sheet.mergeCells(`B${rowNumber}:${lastColumn}${rowNumber}`);
    row.getCell(2).value = value;
    row.getCell(1).font = { bold: true, color: { argb: "FF475569" } };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7D6" } };
    row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    row.getCell(2).alignment = { vertical: "top", horizontal: "left", wrapText: true };
    if (value instanceof Date) row.getCell(2).numFmt = "dd/mm/yyyy hh:mm:ss";
    row.height =
      typeof value === "string" && value.includes("\n")
        ? Math.min(60, 18 + value.split("\n").length * 12)
        : 22;
    rowNumber += 1;
  }

  sheet.mergeCells(`A${rowNumber}:${lastColumn}${rowNumber}`);
  const noteCell = sheet.getCell(`A${rowNumber}`);
  noteCell.value = activeFilters.length
    ? `ใช้ตัวกรอง ${activeFilters.length} มิติ ข้อมูลและยอดรวมด้านล่างตรงกับมุมมองบนหน้า /reports`
    : "ไม่จำกัดตัวกรอง ข้อมูลและยอดรวมด้านล่างตรงกับมุมมองบนหน้า /reports";
  noteCell.font = { italic: true, color: { argb: "FF475569" } };
  noteCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  noteCell.alignment = { vertical: "middle", wrapText: true };
  sheet.getRow(rowNumber).height = 24;

  const headerRowNumber = rowNumber + 2;
  const headerRow = sheet.getRow(headerRowNumber);
  headerRow.values = ["ส่วนงาน", ...report.months, "รายได้สะสม"];
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FF111827" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2C94C" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: "FFD19A00" } } };
  });
  headerRow.getCell(1).alignment = { vertical: "middle", horizontal: "left" };

  const firstDataRow = headerRowNumber + 1;
  report.rows.forEach((reportRow, index) => {
    const currentRowNumber = firstDataRow + index;
    const row = sheet.getRow(currentRowNumber);
    row.values = [
      reportRow.sectionName,
      ...report.months.map((period) => Number(reportRow.monthlyRevenue[period] ?? 0)),
      null,
    ];
    const firstMoneyColumn = 2;
    const lastMonthColumn = report.months.length + 1;
    row.getCell(columnCount).value = {
      formula: `SUM(${columnName(firstMoneyColumn)}${currentRowNumber}:${columnName(lastMonthColumn)}${currentRowNumber})`,
      result: Number(reportRow.ytdRevenue),
    };
    row.getCell(1).alignment = { vertical: "middle", wrapText: true };
    for (let column = firstMoneyColumn; column <= columnCount; column += 1) {
      row.getCell(column).numFmt = moneyFormat;
      row.getCell(column).alignment = { vertical: "middle", horizontal: "right" };
    }
    if (index % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
    }
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "hair", color: { argb: "FFE2E8F0" } } };
    });
  });

  const totalRowNumber = firstDataRow + report.rows.length;
  const totalRow = sheet.getRow(totalRowNumber);
  totalRow.getCell(1).value = "รายได้สะสม";
  totalRow.getCell(1).font = { bold: true };
  report.months.forEach((period, index) => {
    const column = index + 2;
    const cell = totalRow.getCell(column);
    const total = Number(report.totals.monthlyRevenue[period] ?? 0);
    cell.value = report.rows.length
      ? {
          formula: `SUM(${columnName(column)}${firstDataRow}:${columnName(column)}${totalRowNumber - 1})`,
          result: total,
        }
      : total;
    cell.numFmt = moneyFormat;
  });
  const grandTotal = Number(report.totals.ytdRevenue);
  totalRow.getCell(columnCount).value = report.rows.length
    ? {
        formula: `SUM(${columnName(columnCount)}${firstDataRow}:${columnName(columnCount)}${totalRowNumber - 1})`,
        result: grandTotal,
      }
    : grandTotal;
  totalRow.getCell(columnCount).numFmt = moneyFormat;
  totalRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FF111827" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7D6" } };
    cell.border = { top: { style: "double", color: { argb: "FFD19A00" } } };
    cell.alignment = { vertical: "middle" };
  });

  sheet.getColumn(1).width = 42;
  for (let column = 2; column < columnCount; column += 1) sheet.getColumn(column).width = 16;
  sheet.getColumn(columnCount).width = 20;
  sheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: Math.max(headerRowNumber, totalRowNumber - 1), column: columnCount },
  };
  sheet.views = [
    {
      state: "frozen",
      xSplit: 1,
      ySplit: headerRowNumber,
      topLeftCell: `B${headerRowNumber + 1}`,
      activeCell: `A${headerRowNumber + 1}`,
      showGridLines: false,
    },
  ];
  sheet.pageSetup.printArea = `A1:${lastColumn}${totalRowNumber}`;
  sheet.headerFooter.oddFooter = `รายงานรายได้ ${formatBuddhistYear(report.reportYear)} · หน้า &P / &N`;

  return workbook;
}

export async function downloadRevenueMatrixWorkbook(input: RevenueMatrixExportInput) {
  const exportedAt = input.exportedAt ?? new Date();
  const workbook = await buildRevenueMatrixWorkbook({ ...input, exportedAt });
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const report = input.report;
  const endPeriod = `${report.reportYear}${String(report.throughMonth).padStart(2, "0")}`;
  const filename = `รายงานรายได้_พศ${report.reportYear + 543}_ถึง_${endPeriod}_${exportTimestamp(exportedAt)}.xlsx`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return filename;
}
