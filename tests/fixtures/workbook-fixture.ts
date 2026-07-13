import * as XLSX from "xlsx";

type FixtureOptions = {
  sheetName?: string;
  headerRow?: number;
  months?: string[];
  rows?: unknown[][];
  extraBlankColumn?: boolean;
  mutate?: (sheet: XLSX.WorkSheet, headerRow: number) => void;
};

export const headers = [
  "หน่วยงาน",
  "ส่วนงาน",
  "รหัสศูนย์ต้นทุน",
  "กลุ่มธุรกิจ",
  "กลุ่มบริการ",
  "รหัสผลิตภัณฑ์",
  "รายบริการ",
  "รวมทั้งสิ้น",
];

export const detail = (
  productCode: string | number = "001",
  months: Array<number | string | null> = [100, 200]
) => [
  "หน่วย A",
  "ส่วน A",
  "CC001",
  "ธุรกิจ A",
  "บริการ A",
  productCode,
  `รายบริการ ${productCode}`,
  months.reduce(
    (sum: number, value) => sum + (typeof value === "number" ? value : Number(value ?? 0)),
    0
  ),
  ...months,
];

export function createWorkbookFixture(options: FixtureOptions = {}): ArrayBuffer {
  const monthHeaders = options.months ?? ["202601", "202602"];
  const headerRow = options.headerRow ?? 3;
  const prefix = options.extraBlankColumn ? [null] : [];
  const rows: unknown[][] = Array.from({ length: headerRow - 1 }, () => ["หัวรายงาน"]);
  rows.push([...prefix, ...headers, ...monthHeaders]);
  for (const row of options.rows ?? [detail()]) rows.push([...prefix, ...row]);

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  options.mutate?.(sheet, headerRow);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, options.sheetName ?? "Report_รายเดือน");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
