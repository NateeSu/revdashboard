import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  abortSignal: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: supabaseMocks.rpc }),
}));

import { fetchBroadbandRevenueOverview } from "@/lib/query/broadband-revenue";

const metrics = {
  currentYtdRevenueBaht: "422970000.00",
  previousComparisonRevenueBaht: "401000000.00",
  differenceBaht: "21970000.00",
  differencePercent: "5.48",
  annualTargetBaht: "1328260000.00",
  expectedTargetBaht: "442753333.33",
  annualTargetPercent: "31.84",
  expectedTargetPercent: "95.53",
  expectedTargetVarianceBaht: "-19783333.33",
};

describe("fetchBroadbandRevenueOverview", () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockReset();
    supabaseMocks.abortSignal.mockReset();
    supabaseMocks.rpc.mockReturnValue({ abortSignal: supabaseMocks.abortSignal });
  });

  it("parses Internet Retail revenue and target data by OP area", async () => {
    supabaseMocks.abortSignal.mockResolvedValue({
      data: {
        reportYear: 2026,
        previousYear: 2025,
        throughMonth: 4,
        hasPreviousYear: true,
        hasComparablePreviousYear: true,
        organization: {
          groupCode: "อป.",
          groupName: "ภาคตะวันออก",
          label: "อป. — ภาคตะวันออก",
        },
        service: {
          businessGroup: "4.Fixed Line & Broadband",
          serviceGroup: "4.2.กลุ่มบริการ Internet Retail",
          label: "Internet Retail (Broadband)",
        },
        targetPacePercent: "33.33",
        rows: [
          {
            key: "section:rayong",
            sortOrder: 25,
            parentKey: "department:op2",
            level: "section",
            unitName: "อป.2",
            sectionName: "ส่วนขายและบริการลูกค้า ระยอง",
            label: "ระยอง",
            targetConfigured: true,
            ...metrics,
          },
          {
            key: "group:op",
            sortOrder: 30,
            parentKey: null,
            level: "group",
            unitName: null,
            sectionName: null,
            label: "อป.",
            targetConfigured: true,
            ...metrics,
          },
        ],
        totals: {
          ...metrics,
          configuredTargetCount: 14,
          requiredTargetCount: 14,
          hasAllTargets: true,
        },
      },
      error: null,
    });

    const result = await fetchBroadbandRevenueOverview(2026);

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("get_broadband_revenue_report", {
      p_year: 2026,
    });
    expect(result.service).toEqual({
      businessGroup: "4.Fixed Line & Broadband",
      serviceGroup: "4.2.กลุ่มบริการ Internet Retail",
      label: "Internet Retail (Broadband)",
    });
    expect(result.rows[0]).toMatchObject({
      label: "ระยอง",
      unitName: "อป.2",
      parentKey: "department:op2",
    });
    expect(result.organization.groupCode).toBe("อป.");
    expect(
      result.rows.every(
        (row) => row.unitName === null || row.unitName === "อป.1" || row.unitName === "อป.2"
      )
    ).toBe(true);
    expect(result.totals.hasAllTargets).toBe(true);
  });
});
