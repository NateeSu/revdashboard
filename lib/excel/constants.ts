export const TARGET_SHEET_NAME = "report_รายเดือน";
export const HEADER_SCAN_ROW_LIMIT = 30;
export const PREVIEW_ROW_LIMIT = 100;
export const DEFAULT_MAX_UPLOAD_MB = 10;
export const INSERT_CHUNK_SIZE = 500;
export const MONEY_TOLERANCE = "0.01";

export const DIMENSION_HEADERS = [
  "หน่วยงาน",
  "ส่วนงาน",
  "รหัสศูนย์ต้นทุน",
  "กลุ่มธุรกิจ",
  "กลุ่มบริการ",
  "รหัสผลิตภัณฑ์",
  "รายบริการ",
] as const;

export const TOTAL_HEADER = "รวมทั้งสิ้น";
export const REQUIRED_HEADERS = [...DIMENSION_HEADERS, TOTAL_HEADER] as const;
export const MONTH_HEADER_PATTERN = /^\d{6}$/;
