export type AvailableYear = {
  report_year: number;
  active_batch_id: string;
  report_end_month: string;
  current_month_revenue: string;
  ytd_revenue: string;
};

export type ReportingPeriod = {
  year: number;
  month: number;
  endMonth: number;
};

function parseEndMonth(value: string): number {
  const month = Number(value.slice(5, 7));
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : 1;
}

export function resolveReportingPeriod(
  availableYears: readonly AvailableYear[],
  requestedYear?: number,
  requestedMonth?: number
): ReportingPeriod {
  const selectedYear =
    availableYears.find((item) => item.report_year === requestedYear) ?? availableYears[0];

  if (!selectedYear) {
    throw new Error("ไม่พบปีที่มีชุดข้อมูลพร้อมใช้งาน");
  }

  const endMonth = parseEndMonth(selectedYear.report_end_month);
  const month =
    Number.isInteger(requestedMonth) && requestedMonth! >= 1 && requestedMonth! <= endMonth
      ? requestedMonth!
      : endMonth;

  return { year: selectedYear.report_year, month, endMonth };
}

export function resolveReportingPeriodFromSearch(
  availableYears: readonly AvailableYear[],
  searchParams: URLSearchParams,
  initialYear: number,
  initialMonth: number
): ReportingPeriod {
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  return resolveReportingPeriod(
    availableYears,
    yearParam === null ? initialYear : Number(yearParam),
    monthParam === null ? (yearParam === null ? initialMonth : undefined) : Number(monthParam)
  );
}

export function getReportEndMonth(availableYears: readonly AvailableYear[], year: number): number {
  return resolveReportingPeriod(availableYears, year).endMonth;
}

export function formatBuddhistYear(year: number): string {
  return `พ.ศ. ${year + 543}`;
}

export function formatThaiMonthName(year: number, month: number): string {
  return new Intl.DateTimeFormat("th-TH", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}
