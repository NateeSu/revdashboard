import type { OpScopedRevenueOverview } from "@/lib/query/op-scoped-revenue";
import { bahtToDisplayValue, revenueDisplayUnitLabel } from "@/lib/revenue/display-money";
import { getOpScopedReportConfig } from "@/lib/revenue/op-scoped-report-config";
import { formatBuddhistYear, formatThaiMonthName } from "@/lib/revenue/reporting-period";

export type OpScopedRevenueExportInput = {
  report: OpScopedRevenueOverview;
  exportedAt?: Date;
};

const moneyFormat = "#,##0.00;[Red]-#,##0.00";
const percentFormat = "0.00%;[Red]-0.00%";

function argb(hex: string): string {
  return `FF${hex.replace("#", "").toUpperCase()}`;
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

export async function buildOpScopedRevenueWorkbook(input: OpScopedRevenueExportInput) {
  const ExcelJSModule = await import("exceljs");
  const ExcelJS = ExcelJSModule.default ?? ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  const exportedAt = input.exportedAt ?? new Date();
  const { report } = input;
  const config = getOpScopedReportConfig(report.scope.key);
  const unitLabel = revenueDisplayUnitLabel(config.displayUnit);
  const monthName = formatThaiMonthName(report.reportYear, report.throughMonth);

  workbook.creator = "Revenue Dashboard";
  workbook.created = exportedAt;
  workbook.modified = exportedAt;
  workbook.subject = `${config.title} ${formatBuddhistYear(report.reportYear)}`;

  const sheet = workbook.addWorksheet(config.title, {
    properties: { defaultRowHeight: 20 },
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.2, right: 0.2, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });
  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 8, showGridLines: false }];

  sheet.mergeCells("A1:J1");
  const title = sheet.getCell("A1");
  title.value = config.title;
  title.font = { name: "Aptos Display", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  title.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: argb(config.theme.structure) },
  };
  title.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 34;

  sheet.mergeCells("A2:J2");
  const subtitle = sheet.getCell("A2");
  subtitle.value = `${report.organization.label} · ${report.scope.label} · มกราคม–${monthName} ${formatBuddhistYear(report.reportYear)}`;
  subtitle.font = { name: "Aptos", size: 11, color: { argb: "FF334155" } };
  subtitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };

  const metadata: Array<[string, string | Date]> = [
    ["ปีรายงาน", formatBuddhistYear(report.reportYear)],
    ["ช่วงข้อมูล", `มกราคม–${monthName} ${formatBuddhistYear(report.reportYear)}`],
    ["ขอบเขตองค์กร", report.organization.label],
    [
      "เป้าหมายตามเวลา",
      `${report.targetPacePercent}% ของเป้าหมายทั้งปี (${report.throughMonth}/12 เดือน)`,
    ],
    ["วันที่เวลา Export", exportedAt],
  ];

  metadata.forEach(([label, value], index) => {
    const row = sheet.getRow(index + 3);
    row.getCell(1).value = label;
    sheet.mergeCells(`B${index + 3}:J${index + 3}`);
    row.getCell(2).value = value;
    row.getCell(1).font = { bold: true, color: { argb: "FF475569" } };
    row.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: argb(config.theme.currentSoft) },
    };
    if (value instanceof Date) row.getCell(2).numFmt = "dd/mm/yyyy hh:mm:ss";
  });

  const headerRowNumber = 8;
  const header = sheet.getRow(headerRowNumber);
  header.values = [
    "พื้นที่",
    `รายได้สะสม ${formatBuddhistYear(report.reportYear)} (${unitLabel})`,
    `ช่วงเดียวกัน ${formatBuddhistYear(report.previousYear)} (${unitLabel})`,
    `ส่วนต่าง (${unitLabel})`,
    "ส่วนต่าง (%)",
    `เป้าหมายทั้งปี (${unitLabel})`,
    `เป้าหมายถึงเดือนล่าสุด (${unitLabel})`,
    "เทียบเป้าทั้งปี (%)",
    "เทียบเป้าถึงเดือนล่าสุด (%)",
    `สูง/ต่ำกว่าเป้าถึงเดือนล่าสุด (${unitLabel})`,
  ];
  header.height = 42;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: argb(config.theme.structure) },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      bottom: { style: "medium", color: { argb: argb(config.theme.currentStrong) } },
    };
  });
  header.getCell(1).alignment = { vertical: "middle", horizontal: "left", wrapText: true };

  const firstDataRow = headerRowNumber + 1;
  report.rows.forEach((reportRow, index) => {
    const row = sheet.getRow(firstDataRow + index);
    const displayLabel = reportRow.level === "section" ? reportRow.label : `รวม ${reportRow.label}`;
    row.values = [
      displayLabel,
      bahtToDisplayValue(reportRow.currentYtdRevenueBaht, config.displayUnit),
      bahtToDisplayValue(reportRow.previousComparisonRevenueBaht, config.displayUnit),
      bahtToDisplayValue(reportRow.differenceBaht, config.displayUnit),
      percentage(reportRow.differencePercent),
      bahtToDisplayValue(reportRow.annualTargetBaht, config.displayUnit),
      bahtToDisplayValue(reportRow.expectedTargetBaht, config.displayUnit),
      percentage(reportRow.annualTargetPercent),
      percentage(reportRow.expectedTargetPercent),
      bahtToDisplayValue(reportRow.expectedTargetVarianceBaht, config.displayUnit),
    ];
    row.getCell(1).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    row.getCell(1).font = { bold: reportRow.level !== "section" };
    for (let column = 2; column <= 4; column += 1) row.getCell(column).numFmt = moneyFormat;
    row.getCell(5).numFmt = percentFormat;
    for (let column = 6; column <= 7; column += 1) row.getCell(column).numFmt = moneyFormat;
    for (let column = 8; column <= 9; column += 1) row.getCell(column).numFmt = percentFormat;
    row.getCell(10).numFmt = moneyFormat;
    for (let column = 2; column <= 10; column += 1) {
      row.getCell(column).alignment = { vertical: "middle", horizontal: "right" };
    }
    if (reportRow.level === "department") {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: argb(config.theme.structureSoft) },
        };
      });
    }
    if (reportRow.level === "group") {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: argb(config.theme.currentSoft) },
        };
        cell.font = { bold: true, color: { argb: argb(config.theme.currentStrong) } };
        cell.border = {
          top: { style: "double", color: { argb: argb(config.theme.structure) } },
        };
      });
      row.height = 28;
    } else {
      row.eachCell((cell) => {
        cell.border = { bottom: { style: "hair", color: { argb: "FFE2E8F0" } } };
      });
    }
  });

  const lastDataRow = firstDataRow + report.rows.length - 1;
  sheet.getColumn(1).width = 34;
  for (let column = 2; column <= 10; column += 1) sheet.getColumn(column).width = 19;
  sheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: lastDataRow, column: 10 },
  };
  sheet.pageSetup.printArea = `A1:J${lastDataRow}`;
  sheet.headerFooter.oddFooter = `${config.title} ${formatBuddhistYear(report.reportYear)} · หน้า &P / &N`;

  return workbook;
}

export async function downloadOpScopedRevenueWorkbook(input: OpScopedRevenueExportInput) {
  const exportedAt = input.exportedAt ?? new Date();
  const config = getOpScopedReportConfig(input.report.scope.key);
  const workbook = await buildOpScopedRevenueWorkbook({ ...input, exportedAt });
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const safeLabel = config.label.replaceAll(/[^A-Za-z0-9ก-๙]+/g, "_");
  const filename = `รายได้_${safeLabel}_พศ${input.report.reportYear + 543}_ถึงเดือน${String(input.report.throughMonth).padStart(2, "0")}_${exportTimestamp(exportedAt)}.xlsx`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return filename;
}
