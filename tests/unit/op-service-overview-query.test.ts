import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  abortSignal: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: supabaseMocks.rpc }),
}));

import { fetchOpServiceOverview } from "@/lib/query/op-service-overview";

describe("fetchOpServiceOverview", () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockReset();
    supabaseMocks.abortSignal.mockReset();
    supabaseMocks.rpc.mockReturnValue({ abortSignal: supabaseMocks.abortSignal });
  });

  it("parses the fixed OP service hierarchy and sparse targets", async () => {
    supabaseMocks.abortSignal.mockResolvedValue({
      data: {
        reportYear: 2026,
        previousYear: 2025,
        throughMonth: 6,
        hasPreviousYear: true,
        hasComparablePreviousYear: true,
        organization: {
          groupCode: "อป.",
          groupName: "ภาคตะวันออก",
          label: "อป. — ภาคตะวันออก",
        },
        targetPacePercent: "50.00",
        rows: [
          {
            key: "business:hard-infrastructure",
            sortOrder: 10,
            parentKey: null,
            level: "business_group",
            businessGroup: "1.Hard Infrastructure",
            serviceGroup: null,
            label: "1. Hard Infrastructure",
            currentYtdRevenueBaht: "2660000.00",
            previousComparisonRevenueBaht: "2000000.00",
            differenceBaht: "660000.00",
            differencePercent: "33.00",
            annualTargetBaht: "12970000.00",
            expectedTargetBaht: "6485000.00",
            annualTargetPercent: "20.51",
            expectedTargetPercent: "41.02",
            expectedTargetVarianceBaht: "-3825000.00",
            targetConfigured: true,
          },
          {
            key: "business:international",
            sortOrder: 20,
            parentKey: null,
            level: "business_group",
            businessGroup: "2.International",
            serviceGroup: null,
            label: "2. International",
            currentYtdRevenueBaht: "470000.00",
            previousComparisonRevenueBaht: "500000.00",
            differenceBaht: "-30000.00",
            differencePercent: "-6.00",
            annualTargetBaht: null,
            expectedTargetBaht: null,
            annualTargetPercent: null,
            expectedTargetPercent: null,
            expectedTargetVarianceBaht: null,
            targetConfigured: false,
          },
        ],
        totals: {
          currentYtdRevenueBaht: "3130000.00",
          previousComparisonRevenueBaht: "2500000.00",
          differenceBaht: "630000.00",
          differencePercent: "25.20",
          annualTargetBaht: "12970000.00",
          expectedTargetBaht: "6485000.00",
          annualTargetPercent: "24.13",
          expectedTargetPercent: "48.27",
          expectedTargetVarianceBaht: "-3355000.00",
          configuredTargetCount: 1,
          requiredTargetCount: 6,
          hasAllBusinessGroupTargets: false,
        },
      },
      error: null,
    });

    const result = await fetchOpServiceOverview(2026);

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("get_op_service_overview_report", {
      p_year: 2026,
    });
    expect(result.organization.groupCode).toBe("อป.");
    expect(result.targetPacePercent).toBe("50.00");
    expect(result.rows[1].annualTargetBaht).toBeNull();
    expect(result.totals.hasAllBusinessGroupTargets).toBe(false);
  });
});
