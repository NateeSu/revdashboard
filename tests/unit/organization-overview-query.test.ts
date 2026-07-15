import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  abortSignal: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: supabaseMocks.rpc }),
}));

import { fetchOrganizationOverview } from "@/lib/query/organization-overview";

describe("fetchOrganizationOverview", () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockReset();
    supabaseMocks.abortSignal.mockReset();
    supabaseMocks.rpc.mockReturnValue({ abortSignal: supabaseMocks.abortSignal });
  });

  it("parses group totals, year comparison, and top sections", async () => {
    supabaseMocks.abortSignal.mockResolvedValue({
      data: {
        reportYear: 2026,
        previousYear: 2025,
        throughMonth: 5,
        comparisonThroughMonth: 5,
        hasPreviousYear: true,
        totalYtdRevenue: "1000.00",
        mappedYtdRevenue: "1000.00",
        groups: [
          {
            code: "นป.",
            name: "ภาคเหนือ",
            label: "นป. — ภาคเหนือ",
            currentYtdRevenue: "400.00",
            sharePercent: "40.00",
            currentComparisonRevenue: "400.00",
            previousComparisonRevenue: "350.00",
            difference: "50.00",
            differencePercent: "14.2857",
            topSections: [
              {
                rank: 1,
                unitName: "นป.1",
                sectionName: "ส่วนขายและบริการลูกค้า เชียงใหม่",
                revenue: "250.00",
              },
            ],
          },
        ],
        unmapped: {
          currentYtdRevenue: "0.00",
          sharePercent: "0.00",
          sectionCount: 0,
          unitNames: [],
        },
      },
      error: null,
    });

    const result = await fetchOrganizationOverview(2026);

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("get_organization_overview_report", {
      p_year: 2026,
    });
    expect(result.groups[0].topSections[0].sectionName).toContain("เชียงใหม่");
    expect(result.groups[0].difference).toBe("50.00");
  });
});
