import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  abortSignal: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: supabaseMocks.rpc }),
}));

import { fetchRevenueMatrixReport } from "@/lib/query/reports";

describe("fetchRevenueMatrixReport", () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockReset();
    supabaseMocks.abortSignal.mockReset();
    supabaseMocks.rpc.mockReturnValue({ abortSignal: supabaseMocks.abortSignal });
  });

  it("parses a monthly section matrix returned by Supabase", async () => {
    supabaseMocks.abortSignal.mockResolvedValue({
      data: {
        reportYear: 2026,
        throughMonth: 2,
        months: ["202601", "202602"],
        rows: [
          {
            sectionName: "ส่วนขายและบริการลูกค้า เชียงใหม่",
            monthlyRevenue: { "202601": "100.00", "202602": "120.00" },
            ytdRevenue: "220.00",
          },
        ],
        totals: {
          monthlyRevenue: { "202601": "100.00", "202602": "120.00" },
          ytdRevenue: "220.00",
        },
      },
      error: null,
    });

    const result = await fetchRevenueMatrixReport({
      year: 2026,
      month: 2,
      filters: { businessGroups: ["กลุ่มธุรกิจตัวอย่าง"] },
    });

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("get_revenue_matrix_report", {
      p_year: 2026,
      p_month: 2,
      p_filters: { businessGroups: ["กลุ่มธุรกิจตัวอย่าง"] },
    });
    expect(result.rows[0].ytdRevenue).toBe("220.00");
    expect(result.totals.monthlyRevenue["202602"]).toBe("120.00");
  });
});
