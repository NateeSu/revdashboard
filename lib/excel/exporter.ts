import Decimal from "decimal.js";

import type { ExplorerLevel } from "@/lib/query/explorer";
import type { RevenueFilters } from "@/lib/revenue/types";
import type { Json, RevenueImportRow } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";

type ExportProgress = (stage: string, processed: number, total?: number) => void;

type ExportMetadata = {
  ownerEmail: string;
  activeBatchId: string;
  originalFilename: string;
  fileHash: string;
  reportEndMonth: string;
};

async function fetchExportRows(
  year: number,
  month: number,
  filters: RevenueFilters,
  onProgress: ExportProgress,
  signal?: AbortSignal
): Promise<RevenueImportRow[]> {
  const supabase = createClient();
  const rows: RevenueImportRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    if (signal?.aborted) throw new DOMException("ยกเลิกการ Export แล้ว", "AbortError");
    const { data, error } = await supabase
      .rpc("get_export_rows", {
        p_year: year,
        p_month: month,
        p_filters: filters as Json,
        p_offset: offset,
        p_limit: 1000,
      })
      .abortSignal(signal ?? new AbortController().signal);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    onProgress("กำลังดึงข้อมูล", rows.length);
    if (page.length < 1000) break;
  }
  return rows;
}

async function fetchExportMetadata(year: number): Promise<ExportMetadata> {
  const supabase = createClient();
  const [{ data: userData }, { data: active, error: activeError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("active_datasets").select("active_batch_id").eq("report_year", year).single(),
  ]);
  if (activeError) throw new Error(activeError.message);
  const { data: batch, error } = await supabase
    .from("import_batches")
    .select("original_filename,file_hash,report_end_month")
    .eq("id", active.active_batch_id)
    .single();
  if (error) throw new Error(error.message);
  return {
    ownerEmail: userData.user?.email ?? "owner",
    activeBatchId: active.active_batch_id,
    originalFilename: batch.original_filename,
    fileHash: batch.file_hash,
    reportEndMonth: batch.report_end_month,
  };
}

function dimensionHeaders(level: ExplorerLevel): Array<[string, keyof RevenueImportRow]> {
  const hierarchy: Array<[string, keyof RevenueImportRow]> = [
    ["หน่วยงาน", "unit_name"],
    ["ส่วนงาน", "section_name"],
    ["รหัสศูนย์ต้นทุน", "cost_center"],
    ["กลุ่มธุรกิจ", "business_group"],
    ["กลุ่มบริการ", "service_group"],
    ["รหัสผลิตภัณฑ์", "product_code"],
    ["รายบริการ", "service_name"],
  ];
  if (level === "unit") return hierarchy.slice(0, 1);
  if (level === "section") return hierarchy.slice(0, 3);
  if (level === "business_group") return hierarchy.slice(0, 4);
  if (level === "service_group") return hierarchy.slice(0, 5);
  return hierarchy;
}

function groupRows(rows: RevenueImportRow[], level: ExplorerLevel, selectedPeriod: string) {
  const dimensions = dimensionHeaders(level);
  const grouped = new Map<
    string,
    {
      dimensions: string[];
      months: Map<string, Decimal>;
    }
  >();
  for (const row of rows) {
    const values = dimensions.map(([, field]) => String(row[field]));
    const key = JSON.stringify(values);
    const item = grouped.get(key) ?? { dimensions: values, months: new Map<string, Decimal>() };
    item.months.set(
      row.period_month,
      (item.months.get(row.period_month) ?? new Decimal(0)).plus(row.revenue_amount ?? 0)
    );
    grouped.set(key, item);
  }
  const previousDate = new Date(`${selectedPeriod}T00:00:00Z`);
  previousDate.setUTCMonth(previousDate.getUTCMonth() - 1);
  const previousPeriod =
    selectedPeriod.slice(5, 7) === "01" ? null : previousDate.toISOString().slice(0, 10);

  return Array.from(grouped.values()).map((item) => {
    const selected = item.months.get(selectedPeriod) ?? new Decimal(0);
    const ytd = Array.from(item.months.values()).reduce(
      (sum, value) => sum.plus(value),
      new Decimal(0)
    );
    const previous = previousPeriod ? (item.months.get(previousPeriod) ?? new Decimal(0)) : null;
    const difference = previous ? selected.minus(previous) : null;
    const percent =
      previous && !previous.isZero() ? (difference?.dividedBy(previous.abs()) ?? null) : null;
    return { ...item, selected, ytd, previous, difference, percent };
  });
}

function applyWorksheetStyle(worksheet: import("exceljs").Worksheet, columnCount: number) {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = `A1:${columnName(columnCount)}${Math.max(worksheet.rowCount, 1)}`;
  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  header.alignment = { vertical: "middle", wrapText: true };
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "hair", color: { argb: "FFE5E7EB" } } };
    });
  });
  worksheet.columns.forEach((column) => {
    column.width = Math.min(Math.max(column.width ?? 14, 12), 42);
  });
}

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

function exportTimestamp() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}${get("month")}${get("day")}_${get("hour")}${get("minute")}${get("second")}`;
}

export async function exportRevenueWorkbook(input: {
  year: number;
  month: number;
  level: ExplorerLevel;
  filters: RevenueFilters;
  onProgress: ExportProgress;
  signal?: AbortSignal;
}) {
  const [rows, metadata] = await Promise.all([
    fetchExportRows(input.year, input.month, input.filters, input.onProgress, input.signal),
    fetchExportMetadata(input.year),
  ]);
  if (rows.length > 100_000)
    input.onProgress("ข้อมูลเกิน 100,000 แถว อาจใช้หน่วยความจำสูง", rows.length, rows.length);
  input.onProgress("กำลังสร้างสรุป", rows.length, rows.length);
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Revenue Dashboard";
  workbook.created = new Date();
  const selectedPeriod = `${input.year}-${String(input.month).padStart(2, "0")}-01`;
  const periods = Array.from(new Set(rows.map((row) => row.period_month))).sort();
  const dimensions = dimensionHeaders(input.level);
  const grouped = groupRows(rows, input.level, selectedPeriod);

  const summarySheet = workbook.addWorksheet("สรุป");
  summarySheet.addRow([
    ...dimensions.map(([label]) => label),
    "รายได้เดือนที่เลือก",
    "รายได้สะสม",
    "รายได้เดือนก่อน",
    "ผลต่าง",
    "% เปลี่ยนแปลง",
  ]);
  grouped.forEach((item) =>
    summarySheet.addRow([
      ...item.dimensions,
      item.selected.toNumber(),
      item.ytd.toNumber(),
      item.previous?.toNumber() ?? null,
      item.difference?.toNumber() ?? null,
      item.percent?.toNumber() ?? null,
    ])
  );
  const summaryMoneyStart = dimensions.length + 1;
  for (let column = summaryMoneyStart; column < summaryMoneyStart + 4; column += 1)
    summarySheet.getColumn(column).numFmt = "#,##0.00;[Red]-#,##0.00";
  summarySheet.getColumn(summaryMoneyStart + 4).numFmt = "0.00%";
  summarySheet.columns = [
    ...dimensions.map(() => ({ width: 24 })),
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 16 },
  ];
  applyWorksheetStyle(summarySheet, summarySheet.columnCount);

  const monthlySheet = workbook.addWorksheet("รายเดือน");
  monthlySheet.addRow([...dimensions.map(([label]) => label), ...periods, "รวมสะสม"]);
  grouped.forEach((item) =>
    monthlySheet.addRow([
      ...item.dimensions,
      ...periods.map((period) => (item.months.get(period) ?? new Decimal(0)).toNumber()),
      item.ytd.toNumber(),
    ])
  );
  for (
    let column = dimensions.length + 1;
    column <= dimensions.length + periods.length + 1;
    column += 1
  )
    monthlySheet.getColumn(column).numFmt = "#,##0.00;[Red]-#,##0.00";
  monthlySheet.columns = [
    ...dimensions.map(() => ({ width: 24 })),
    ...periods.map(() => ({ width: 16 })),
    { width: 18 },
  ];
  applyWorksheetStyle(monthlySheet, monthlySheet.columnCount);

  const detailSheet = workbook.addWorksheet("รายละเอียด");
  detailSheet.addRow([
    "เดือน",
    "หน่วยงาน",
    "ส่วนงาน",
    "รหัสศูนย์ต้นทุน",
    "กลุ่มธุรกิจ",
    "กลุ่มบริการ",
    "รหัสผลิตภัณฑ์",
    "รายบริการ",
    "รายได้",
    "Source Blank",
    "Import Batch ID",
    "Source Row",
  ]);
  rows.forEach((row) =>
    detailSheet.addRow([
      new Date(`${row.period_month}T00:00:00Z`),
      row.unit_name,
      row.section_name,
      row.cost_center,
      row.business_group,
      row.service_group,
      row.product_code,
      row.service_name,
      row.source_is_blank ? null : Number(row.revenue_amount),
      row.source_is_blank,
      row.batch_id,
      row.source_row_number,
    ])
  );
  detailSheet.getColumn(1).numFmt = "mmm yyyy";
  detailSheet.getColumn(9).numFmt = "#,##0.00;[Red]-#,##0.00";
  detailSheet.columns = [
    { width: 14 },
    { width: 16 },
    { width: 36 },
    { width: 18 },
    { width: 24 },
    { width: 42 },
    { width: 18 },
    { width: 42 },
    { width: 18 },
    { width: 14 },
    { width: 38 },
    { width: 12 },
  ];
  applyWorksheetStyle(detailSheet, detailSheet.columnCount);

  const conditionSheet = workbook.addWorksheet("เงื่อนไขรายงาน");
  conditionSheet.addRows([
    ["เงื่อนไข", "ค่า"],
    ["วันที่เวลา Export", new Date()],
    ["ผู้ Export", metadata.ownerEmail],
    ["ปี", input.year],
    ["เดือน", input.month],
    ["ระดับข้อมูล", input.level],
    ["Filters", JSON.stringify(input.filters)],
    ["Active Batch ID", metadata.activeBatchId],
    ["Original filename", metadata.originalFilename],
    ["File hash", metadata.fileHash],
    ["Report end month", metadata.reportEndMonth],
    ["Row count", rows.length],
  ]);
  conditionSheet.columns = [{ width: 24 }, { width: 70 }];
  conditionSheet.getColumn(2).alignment = { wrapText: true, vertical: "top" };
  applyWorksheetStyle(conditionSheet, conditionSheet.columnCount);

  input.onProgress("กำลังสร้างไฟล์", rows.length, rows.length);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const timestamp = exportTimestamp();
  const filename = `รายงานรายได้_${input.year + 543}_${input.year}${String(input.month).padStart(2, "0")}_${timestamp}.xlsx`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return filename;
}
