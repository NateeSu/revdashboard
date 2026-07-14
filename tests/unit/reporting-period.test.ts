import { describe, expect, it } from "vitest";

import {
  formatBuddhistYear,
  resolveReportingPeriod,
  resolveReportingPeriodFromSearch,
  type AvailableYear,
} from "@/lib/revenue/reporting-period";

const availableYears: AvailableYear[] = [
  {
    report_year: 2026,
    active_batch_id: "batch-2026",
    report_end_month: "2026-05-01",
    current_month_revenue: "100.00",
    ytd_revenue: "500.00",
  },
  {
    report_year: 2025,
    active_batch_id: "batch-2025",
    report_end_month: "2025-12-01",
    current_month_revenue: "120.00",
    ytd_revenue: "1200.00",
  },
];

describe("reporting period", () => {
  it("uses the latest available month for each selected year", () => {
    expect(resolveReportingPeriod(availableYears, 2026)).toEqual({
      year: 2026,
      month: 5,
      endMonth: 5,
    });
    expect(resolveReportingPeriod(availableYears, 2025)).toEqual({
      year: 2025,
      month: 12,
      endMonth: 12,
    });
  });

  it("clamps an unavailable month to the selected year's latest month", () => {
    expect(resolveReportingPeriod(availableYears, 2026, 12)).toEqual({
      year: 2026,
      month: 5,
      endMonth: 5,
    });
  });

  it("does not reuse the previous year's month after changing the year in the URL", () => {
    expect(
      resolveReportingPeriodFromSearch(availableYears, new URLSearchParams("year=2025"), 2026, 5)
    ).toEqual({ year: 2025, month: 12, endMonth: 12 });
  });

  it("formats Gregorian storage years as Buddhist years for the UI", () => {
    expect(formatBuddhistYear(2025)).toBe("พ.ศ. 2568");
    expect(formatBuddhistYear(2026)).toBe("พ.ศ. 2569");
  });
});
