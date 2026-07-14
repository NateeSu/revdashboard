import { formatBuddhistYear, formatThaiMonthName } from "@/lib/revenue/reporting-period";
import type { RevenueFilters } from "@/lib/revenue/types";

export const reportFilterDefinitions: Array<{
  key: keyof RevenueFilters;
  label: string;
}> = [
  { key: "businessGroups", label: "กลุ่มธุรกิจ" },
  { key: "serviceGroups", label: "กลุ่มบริการ" },
  { key: "serviceNames", label: "รายบริการ" },
  { key: "unitNames", label: "ฝ่าย" },
  { key: "sectionNames", label: "ส่วนงาน" },
  { key: "costCenters", label: "ศูนย์ต้นทุน" },
  { key: "productCodes", label: "รหัสผลิตภัณฑ์" },
];

export function getReportFilterDetails(filters: RevenueFilters) {
  return reportFilterDefinitions.map((definition) => ({
    ...definition,
    values: filters[definition.key] ?? [],
  }));
}

export function formatReportPeriodRange(year: number, throughMonth: number): string {
  const startMonth = formatThaiMonthName(year, 1);
  const endMonth = formatThaiMonthName(year, throughMonth);
  const months = throughMonth === 1 ? startMonth : `${startMonth}–${endMonth}`;
  return `${months} ${formatBuddhistYear(year)}`;
}
