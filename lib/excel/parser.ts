import Decimal from "decimal.js";
import type { WorkBook, WorkSheet } from "xlsx";

import {
  DIMENSION_HEADERS,
  HEADER_SCAN_ROW_LIMIT,
  MONTH_HEADER_PATTERN,
  REQUIRED_HEADERS,
  TARGET_SHEET_NAME,
  TOTAL_HEADER,
} from "@/lib/excel/constants";
import { decimalToMoney, getCell, parseMoneyCell, readTextCell } from "@/lib/excel/cells";
import { sha256Hex } from "@/lib/excel/hash";
import {
  canonicalDimensionKey,
  isTotalLabel,
  normalizeHeader,
  normalizeSheetName,
  normalizeText,
} from "@/lib/excel/normalization";
import { transformDetailsToRevenueRows } from "@/lib/excel/transformer";
import type {
  DimensionCounts,
  DimensionValues,
  ExcludedRowCounts,
  ExcludedRowType,
  ParseResult,
  ParseWorkbookOptions,
  ParsedDetailRow,
  ValidationIssue,
} from "@/lib/excel/types";
import { ExcelParseError } from "@/lib/excel/types";
import { hasBlockingIssues, moneyMatches, validationIssue } from "@/lib/excel/validator";

type HeaderMap = Map<string, number>;
type MonthColumn = { period: string; columnIndex: number };

type DetailDraft = DimensionValues & {
  sourceRowNumber: number;
  canonicalKey: string;
  sourceTotal: Decimal;
  calculatedYtd: Decimal;
  monthlyAmounts: Record<string, string | null>;
  sourceBlanks: Record<string, boolean>;
};

type GrandTotalControl = {
  sourceRowNumber: number;
  ytd: Decimal;
  months: Record<string, Decimal>;
};

const emptyExcludedCounts = (): ExcludedRowCounts => ({
  serviceGroupTotal: 0,
  businessGroupTotal: 0,
  sectionTotal: 0,
  unitTotal: 0,
  grandTotal: 0,
  noteOrBlank: 0,
});

function blocking(code: string, message: string): never {
  throw new ExcelParseError(message, [{ code, severity: "error", message }]);
}

function decodeUsedRange(
  sheet: WorkSheet,
  decodeRange: (range: string) => { s: { r: number; c: number }; e: { r: number; c: number } }
) {
  if (!sheet["!ref"]) blocking("WORKSHEET_EMPTY", "ชีทเป้าหมายไม่มีข้อมูล");
  return decodeRange(sheet["!ref"] as string);
}

function findTargetSheet(workbook: WorkBook): string {
  const matches = workbook.SheetNames.filter(
    (name) => normalizeSheetName(name) === TARGET_SHEET_NAME
  );
  if (matches.length === 0) {
    blocking(
      "TARGET_SHEET_MISSING",
      "ไม่พบชีท Report_รายเดือน กรุณาตรวจสอบชื่อชีทในไฟล์แล้วลองอีกครั้ง"
    );
  }
  if (matches.length > 1) {
    blocking("TARGET_SHEET_AMBIGUOUS", `พบชีทที่ชื่อซ้ำกันหลัง Normalize: ${matches.join(", ")}`);
  }
  return matches[0];
}

function detectHeaderRow(
  sheet: WorkSheet,
  range: { s: { r: number; c: number }; e: { r: number; c: number } }
): { headerRowIndex: number; headers: HeaderMap; monthColumns: MonthColumn[] } {
  const candidates: Array<{
    headerRowIndex: number;
    headers: HeaderMap;
    monthColumns: MonthColumn[];
  }> = [];
  const lastScanRow = Math.min(range.e.r, range.s.r + HEADER_SCAN_ROW_LIMIT - 1);

  for (let rowIndex = range.s.r; rowIndex <= lastScanRow; rowIndex += 1) {
    const headers = new Map<string, number>();
    const duplicates = new Set<string>();
    const monthColumns: MonthColumn[] = [];
    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const label = normalizeHeader(readTextCell(getCell(sheet, rowIndex, columnIndex), true));
      if (!label) continue;
      if (headers.has(label)) duplicates.add(label);
      headers.set(label, columnIndex);
      if (MONTH_HEADER_PATTERN.test(label)) monthColumns.push({ period: label, columnIndex });
    }
    const hasRequired = REQUIRED_HEADERS.every((header) => headers.has(normalizeHeader(header)));
    const hasDuplicateRequired = REQUIRED_HEADERS.some((header) =>
      duplicates.has(normalizeHeader(header))
    );
    if (hasRequired && !hasDuplicateRequired && monthColumns.length > 0) {
      candidates.push({ headerRowIndex: rowIndex, headers, monthColumns });
    }
  }

  if (candidates.length === 0) {
    blocking("HEADER_ROW_MISSING", "ไม่พบแถว Header ที่มีหัวข้อบังคับและคอลัมน์เดือนครบ");
  }
  if (candidates.length > 1) {
    blocking(
      "HEADER_ROW_AMBIGUOUS",
      `พบ Header ที่เป็นไปได้มากกว่าหนึ่งแถว: ${candidates.map((item) => item.headerRowIndex + 1).join(", ")}`
    );
  }
  return candidates[0];
}

function validateMonthColumns(monthColumns: MonthColumn[]): {
  reportYear: number;
  reportEndMonth: string;
} {
  const periods = monthColumns.map(({ period }) => period);
  if (new Set(periods).size !== periods.length) blocking("DUPLICATE_MONTH", "พบคอลัมน์เดือนซ้ำกัน");

  const parsed = periods.map((period) => ({
    period,
    year: Number(period.slice(0, 4)),
    month: Number(period.slice(4, 6)),
  }));
  if (parsed.some(({ year, month }) => year < 2000 || year > 2200 || month < 1 || month > 12)) {
    blocking("INVALID_MONTH_HEADER", "รูปแบบเดือนต้องเป็นปี Gregorian และเดือน 01–12");
  }
  if (new Set(parsed.map(({ year }) => year)).size !== 1) {
    blocking("MONTHS_SPAN_YEARS", "คอลัมน์เดือนต้องอยู่ในปีเดียวกัน");
  }
  if (parsed[0]?.month !== 1)
    blocking("MONTHS_NOT_FROM_JANUARY", "คอลัมน์เดือนต้องเริ่มจากเดือนมกราคม");
  if (parsed.some(({ month }, index) => month !== index + 1)) {
    blocking("MONTHS_NOT_CONTINUOUS", "คอลัมน์เดือนต้องเรียงต่อเนื่องจากมกราคม");
  }
  return { reportYear: parsed[0].year, reportEndMonth: periods.at(-1) as string };
}

function readDimensions(sheet: WorkSheet, rowIndex: number, headers: HeaderMap): DimensionValues {
  const read = (header: (typeof DIMENSION_HEADERS)[number], preferFormatted = false) =>
    readTextCell(
      getCell(sheet, rowIndex, headers.get(normalizeHeader(header)) as number),
      preferFormatted
    );
  return {
    unitName: read("หน่วยงาน"),
    sectionName: read("ส่วนงาน"),
    costCenter: read("รหัสศูนย์ต้นทุน", true),
    businessGroup: read("กลุ่มธุรกิจ"),
    serviceGroup: read("กลุ่มบริการ"),
    productCode: read("รหัสผลิตภัณฑ์", true),
    serviceName: read("รายบริการ"),
  };
}

function classifyExcludedRow(dimensions: DimensionValues): ExcludedRowType {
  if (normalizeText(dimensions.unitName) === TOTAL_HEADER) return "grandTotal";
  if (isTotalLabel(dimensions.serviceGroup)) return "serviceGroupTotal";
  if (isTotalLabel(dimensions.businessGroup)) return "businessGroupTotal";
  if (isTotalLabel(dimensions.sectionName)) return "sectionTotal";
  if (isTotalLabel(dimensions.unitName)) return "unitTotal";
  return "noteOrBlank";
}

function isDetailRow(dimensions: DimensionValues): boolean {
  const values = Object.values(dimensions);
  return (
    values.every(Boolean) && !values.some(isTotalLabel) && dimensions.unitName !== TOTAL_HEADER
  );
}

function dimensionCounts(details: readonly DetailDraft[]): DimensionCounts {
  const count = (selector: (detail: DetailDraft) => string) => new Set(details.map(selector)).size;
  return {
    units: count((detail) => detail.unitName),
    sections: count((detail) => detail.sectionName),
    costCenters: count((detail) => detail.costCenter),
    businessGroups: count((detail) => detail.businessGroup),
    serviceGroups: count((detail) => detail.serviceGroup),
    products: count((detail) => detail.productCode),
    services: count((detail) => detail.serviceName),
  };
}

export async function parseRevenueWorkbook(
  data: ArrayBuffer,
  options: ParseWorkbookOptions = {}
): Promise<ParseResult> {
  const XLSX = await import("xlsx");
  let workbook: WorkBook;
  try {
    workbook = XLSX.read(data, { type: "array", cellFormula: true, cellNF: true, cellText: true });
  } catch {
    blocking("WORKBOOK_PARSE_FAILED", "ไม่สามารถอ่านไฟล์ Excel ได้ กรุณาตรวจสอบว่าไฟล์ไม่เสียหาย");
  }

  const sheetName = findTargetSheet(workbook);
  const sheet = workbook.Sheets[sheetName];
  const range = decodeUsedRange(sheet, XLSX.utils.decode_range);
  const { headerRowIndex, headers, monthColumns } = detectHeaderRow(sheet, range);
  const { reportYear, reportEndMonth } = validateMonthColumns(monthColumns);
  const issues: ValidationIssue[] = [];
  const excludedRows = emptyExcludedCounts();
  const detailDrafts: DetailDraft[] = [];
  const canonicalKeys = new Map<string, number>();
  const monthlyTotals = Object.fromEntries(
    monthColumns.map(({ period }) => [period, new Decimal(0)])
  );
  let blankRevenueCellCount = 0;
  let zeroRevenueCellCount = 0;
  let negativeRevenueCellCount = 0;
  let negativeRevenueAmount = new Decimal(0);
  let rowTotalMismatchCount = 0;
  let duplicateDetailKeyCount = 0;
  let grandTotal: GrandTotalControl | undefined;

  for (let rowIndex = headerRowIndex + 1; rowIndex <= range.e.r; rowIndex += 1) {
    const sourceRowNumber = rowIndex + 1;
    const dimensions = readDimensions(sheet, rowIndex, headers);
    if (!isDetailRow(dimensions)) {
      const classification = classifyExcludedRow(dimensions);
      excludedRows[classification] += 1;
      if (classification === "grandTotal") {
        try {
          const ytd = parseMoneyCell(
            getCell(sheet, rowIndex, headers.get(normalizeHeader(TOTAL_HEADER)) as number)
          ).value;
          const months: Record<string, Decimal> = {};
          for (const month of monthColumns) {
            months[month.period] =
              parseMoneyCell(getCell(sheet, rowIndex, month.columnIndex)).value ?? new Decimal(0);
          }
          if (ytd) grandTotal = { sourceRowNumber, ytd, months };
        } catch (error) {
          issues.push(
            validationIssue({
              code: "GRAND_TOTAL_PARSE_FAILED",
              severity: "error",
              message: "ไม่สามารถอ่านค่าจากแถวรวมทั้งสิ้นได้",
              sourceRow: sourceRowNumber,
              actual: error instanceof Error ? error.message : null,
            })
          );
        }
      }
      continue;
    }

    const canonicalKey = canonicalDimensionKey(Object.values(dimensions));
    if (canonicalKeys.has(canonicalKey)) {
      duplicateDetailKeyCount += 1;
      issues.push(
        validationIssue({
          code: "DUPLICATE_DETAIL_KEY",
          severity: "error",
          message: "พบชุดมิติข้อมูลซ้ำกับแถวรายละเอียดก่อนหน้า",
          sourceRow: sourceRowNumber,
          expected: canonicalKeys.get(canonicalKey) ?? null,
        })
      );
    } else {
      canonicalKeys.set(canonicalKey, sourceRowNumber);
    }

    const monthlyAmounts: Record<string, string | null> = {};
    const sourceBlanks: Record<string, boolean> = {};
    let calculatedYtd = new Decimal(0);
    let rowHasMoneyError = false;

    for (const month of monthColumns) {
      try {
        const parsed = parseMoneyCell(getCell(sheet, rowIndex, month.columnIndex));
        sourceBlanks[month.period] = parsed.sourceIsBlank;
        monthlyAmounts[month.period] = parsed.value ? decimalToMoney(parsed.value) : null;
        if (parsed.sourceIsBlank) blankRevenueCellCount += 1;
        if (parsed.value) {
          calculatedYtd = calculatedYtd.plus(parsed.value);
          monthlyTotals[month.period] = monthlyTotals[month.period].plus(parsed.value);
          if (parsed.value.isZero()) zeroRevenueCellCount += 1;
          if (parsed.value.isNegative()) {
            negativeRevenueCellCount += 1;
            negativeRevenueAmount = negativeRevenueAmount.plus(parsed.value);
          }
        }
      } catch (error) {
        rowHasMoneyError = true;
        issues.push(
          validationIssue({
            code:
              error instanceof Error && error.message === "FORMULA_WITHOUT_CACHED_VALUE"
                ? "FORMULA_WITHOUT_CACHED_VALUE"
                : "MONEY_PARSE_FAILED",
            severity: "error",
            message: `ไม่สามารถอ่านจำนวนเงินงวด ${month.period} ได้`,
            sourceRow: sourceRowNumber,
            field: month.period,
            actual: error instanceof Error ? error.message : null,
          })
        );
      }
    }

    try {
      const sourceTotal = parseMoneyCell(
        getCell(sheet, rowIndex, headers.get(normalizeHeader(TOTAL_HEADER)) as number)
      ).value;
      if (!sourceTotal) throw new Error("BLANK_ROW_TOTAL");
      if (!rowHasMoneyError && !moneyMatches(sourceTotal, calculatedYtd)) {
        rowTotalMismatchCount += 1;
        issues.push(
          validationIssue({
            code: "ROW_TOTAL_MISMATCH",
            severity: "error",
            message: "ยอดรวมทั้งสิ้นของแถวไม่ตรงกับผลรวมรายเดือน",
            sourceRow: sourceRowNumber,
            expected: decimalToMoney(calculatedYtd),
            actual: decimalToMoney(sourceTotal),
          })
        );
      }
      detailDrafts.push({
        ...dimensions,
        sourceRowNumber,
        canonicalKey,
        sourceTotal,
        calculatedYtd,
        monthlyAmounts,
        sourceBlanks,
      });
    } catch (error) {
      issues.push(
        validationIssue({
          code: "ROW_TOTAL_PARSE_FAILED",
          severity: "error",
          message: "ไม่สามารถอ่านยอดรวมทั้งสิ้นของแถวรายละเอียดได้",
          sourceRow: sourceRowNumber,
          field: TOTAL_HEADER,
          actual: error instanceof Error ? error.message : null,
        })
      );
    }
  }

  if (detailDrafts.length === 0)
    blocking("NO_DETAIL_ROWS", "ไม่พบแถวรายละเอียดที่มีมิติครบทั้ง 7 ช่อง");

  if (!grandTotal) {
    issues.push(
      validationIssue({
        code: "GRAND_TOTAL_MISSING",
        severity: "warning",
        message: "ไม่พบแถวรวมทั้งสิ้นสำหรับตรวจสอบยอดควบคุม",
      })
    );
  } else {
    for (const month of monthColumns) {
      if (!moneyMatches(grandTotal.months[month.period], monthlyTotals[month.period])) {
        issues.push(
          validationIssue({
            code: "GRAND_TOTAL_MISMATCH",
            severity: "error",
            message: `ยอดรวมทั้งสิ้นงวด ${month.period} ไม่ตรงกับผลรวมแถวรายละเอียด`,
            sourceRow: grandTotal.sourceRowNumber,
            expected: decimalToMoney(monthlyTotals[month.period]),
            actual: decimalToMoney(grandTotal.months[month.period]),
          })
        );
      }
    }
    const ytdControl = Object.values(monthlyTotals).reduce(
      (sum, value) => sum.plus(value),
      new Decimal(0)
    );
    if (!moneyMatches(grandTotal.ytd, ytdControl)) {
      issues.push(
        validationIssue({
          code: "GRAND_TOTAL_YTD_MISMATCH",
          severity: "error",
          message: "ยอดรวมทั้งสิ้นสะสมไม่ตรงกับผลรวมแถวรายละเอียด",
          sourceRow: grandTotal.sourceRowNumber,
          expected: decimalToMoney(ytdControl),
          actual: decimalToMoney(grandTotal.ytd),
        })
      );
    }
  }

  if (negativeRevenueCellCount > 0)
    issues.push(
      validationIssue({
        code: "NEGATIVE_REVENUE",
        severity: "warning",
        message: `พบรายได้ติดลบ ${negativeRevenueCellCount.toLocaleString("th-TH")} ช่อง`,
      })
    );
  if (blankRevenueCellCount > 0)
    issues.push(
      validationIssue({
        code: "BLANK_REVENUE",
        severity: "warning",
        message: `พบช่องรายได้ว่าง ${blankRevenueCellCount.toLocaleString("th-TH")} ช่อง`,
      })
    );
  if (zeroRevenueCellCount > 0)
    issues.push(
      validationIssue({
        code: "ZERO_REVENUE",
        severity: "warning",
        message: `พบรายได้ศูนย์ ${zeroRevenueCellCount.toLocaleString("th-TH")} ช่อง`,
      })
    );
  if (options.filename && !options.filename.includes(reportEndMonth)) {
    issues.push(
      validationIssue({
        code: "FILENAME_PERIOD_MISMATCH",
        severity: "warning",
        message: `ชื่อไฟล์ไม่มีงวดล่าสุด ${reportEndMonth}`,
      })
    );
  }

  const details: ParsedDetailRow[] = await Promise.all(
    detailDrafts.map(async (detail) => ({
      unitName: detail.unitName,
      sectionName: detail.sectionName,
      costCenter: detail.costCenter,
      businessGroup: detail.businessGroup,
      serviceGroup: detail.serviceGroup,
      productCode: detail.productCode,
      serviceName: detail.serviceName,
      sourceRowNumber: detail.sourceRowNumber,
      recordKey: await sha256Hex(detail.canonicalKey),
      sourceTotal: decimalToMoney(detail.sourceTotal),
      calculatedYtd: decimalToMoney(detail.calculatedYtd),
      monthlyAmounts: detail.monthlyAmounts,
      sourceBlanks: detail.sourceBlanks,
    }))
  );
  const periods = monthColumns.map(({ period }) => period);
  const revenueRows = transformDetailsToRevenueRows(details, periods);
  const counts = dimensionCounts(detailDrafts);
  const ytdRevenue = Object.values(monthlyTotals).reduce(
    (sum, value) => sum.plus(value),
    new Decimal(0)
  );
  const fileHash = await sha256Hex(data);

  issues.push(
    validationIssue({
      code: "DIMENSION_COUNTS",
      severity: "info",
      message: `มิติ: ${counts.units} หน่วยงาน, ${counts.sections} ส่วนงาน, ${counts.services} บริการ`,
    })
  );

  const summary = {
    valid: !hasBlockingIssues(issues),
    sheetName,
    headerRow: headerRowIndex + 1,
    reportYear,
    reportEndMonth,
    monthColumns: periods,
    sourceRowCount: range.e.r - headerRowIndex,
    detailRowCount: details.length,
    generatedRevenueRowCount: revenueRows.length,
    serviceGroupTotalCount: excludedRows.serviceGroupTotal,
    businessGroupTotalCount: excludedRows.businessGroupTotal,
    sectionTotalCount: excludedRows.sectionTotal,
    unitTotalCount: excludedRows.unitTotal,
    grandTotalCount: excludedRows.grandTotal,
    ignoredNoteOrBlankCount: excludedRows.noteOrBlank,
    blankRevenueCellCount,
    zeroRevenueCellCount,
    negativeRevenueCellCount,
    negativeRevenueAmount: decimalToMoney(negativeRevenueAmount),
    currentMonthRevenue: decimalToMoney(monthlyTotals[reportEndMonth]),
    ytdRevenue: decimalToMoney(ytdRevenue),
    duplicateDetailKeyCount,
    rowTotalMismatchCount,
    issues,
  };

  return {
    fileHash,
    summary,
    details,
    revenueRows,
    monthlyTotals: periods.map((period) => ({
      period,
      revenue: decimalToMoney(monthlyTotals[period]),
    })),
    excludedRows,
    dimensionCounts: counts,
  };
}
