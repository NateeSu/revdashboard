import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  abortSignal: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: supabaseMocks.rpc }),
}));

import { fetchYearOverYearComparison } from "@/lib/query/year-over-year";

describe("fetchYearOverYearComparison", () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockReset();
    supabaseMocks.abortSignal.mockReset();
    supabaseMocks.rpc.mockReturnValue({ abortSignal: supabaseMocks.abortSignal });
  });

  it("parses a same-period comparison and preserves unmatched services", async () => {
    supabaseMocks.abortSignal.mockResolvedValue({
      data: {
        currentYear: 2026,
        previousYear: 2025,
        requestedMonth: 5,
        comparisonThroughMonth: 5,
        level: "service",
        monthlyTrend: [
          {
            month: 1,
            currentRevenue: "110.00",
            previousRevenue: "100.00",
            change: "10.00",
            changePercent: "10.00",
          },
        ],
        rows: [
          {
            key: '["หน่วยงาน","ส่วนงาน","P01","บริการ"]',
            unitName: "หน่วยงาน",
            sectionName: "ส่วนงาน",
            productCode: "P01",
            serviceName: "บริการ",
            matchStatus: "both",
            currentMonthRevenue: "110.00",
            previousMonthRevenue: "100.00",
            monthChange: "10.00",
            monthChangePercent: "10.00",
            currentYtdRevenue: "510.00",
            previousYtdRevenue: "500.00",
            ytdChange: "10.00",
            ytdChangePercent: "2.00",
          },
          {
            key: '["หน่วยงาน","ส่วนงาน","P02","บริการใหม่"]',
            unitName: "หน่วยงาน",
            sectionName: "ส่วนงาน",
            productCode: "P02",
            serviceName: "บริการใหม่",
            matchStatus: "current_only",
            currentMonthRevenue: "50.00",
            previousMonthRevenue: "0.00",
            monthChange: "50.00",
            monthChangePercent: null,
            currentYtdRevenue: "250.00",
            previousYtdRevenue: "0.00",
            ytdChange: "250.00",
            ytdChangePercent: null,
          },
        ],
      },
      error: null,
    });

    const result = await fetchYearOverYearComparison({
      year: 2026,
      month: 5,
      level: "service",
      filters: { sectionNames: ["ส่วนงาน"] },
    });

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("get_year_over_year_comparison", {
      p_year: 2026,
      p_month: 5,
      p_level: "service",
      p_filters: { sectionNames: ["ส่วนงาน"] },
    });
    expect(result.comparisonThroughMonth).toBe(5);
    expect(result.rows.map((row) => row.matchStatus)).toEqual(["both", "current_only"]);
  });
});
