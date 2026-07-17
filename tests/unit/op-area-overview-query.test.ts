import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  abortSignal: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: supabaseMocks.rpc }),
}));

import { fetchOpAreaOverview } from "@/lib/query/op-area-overview";

const metrics = {
  currentYtdRevenueBaht: "104576858.10",
  previousComparisonRevenueBaht: "100000000.00",
  differenceBaht: "4576858.10",
  differencePercent: "4.58",
  annualTargetBaht: "357120000.00",
  expectedTargetBaht: "119040000.00",
  annualTargetPercent: "29.28",
  expectedTargetPercent: "87.85",
  expectedTargetVarianceBaht: "-14463141.90",
};

describe("fetchOpAreaOverview", () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockReset();
    supabaseMocks.abortSignal.mockReset();
    supabaseMocks.rpc.mockReturnValue({ abortSignal: supabaseMocks.abortSignal });
  });

  it("parses the database-backed area hierarchy with Rayong under OP2", async () => {
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

    const result = await fetchOpAreaOverview(2026);

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("get_op_area_overview_report", {
      p_year: 2026,
    });
    expect(result.rows[0]).toMatchObject({
      label: "ระยอง",
      unitName: "อป.2",
      parentKey: "department:op2",
    });
    expect(result.totals.hasAllTargets).toBe(true);
  });
});
