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

const rowDefinitions = [
  [
    "section:chanthaburi",
    10,
    "department:op1",
    "section",
    "อป.1",
    "ส่วนขายและบริการลูกค้า จันทบุรี",
    "จันทบุรี",
  ],
  ["section:trat", 11, "department:op1", "section", "อป.1", "ส่วนขายและบริการลูกค้า ตราด", "ตราด"],
  [
    "section:nakhon-nayok",
    12,
    "department:op1",
    "section",
    "อป.1",
    "ส่วนขายและบริการลูกค้า นครนายก",
    "นครนายก",
  ],
  [
    "section:prachinburi",
    13,
    "department:op1",
    "section",
    "อป.1",
    "ส่วนขายและบริการลูกค้า ปราจีนบุรี",
    "ปราจีนบุรี",
  ],
  [
    "section:sa-kaeo",
    14,
    "department:op1",
    "section",
    "อป.1",
    "ส่วนขายและบริการลูกค้า สระแก้ว",
    "สระแก้ว",
  ],
  ["department:op1", 15, "group:op", "department", "อป.1", null, "อป.1"],
  [
    "section:chachoengsao",
    20,
    "department:op2",
    "section",
    "อป.2",
    "ส่วนขายและบริการลูกค้า ฉะเชิงเทรา",
    "ฉะเชิงเทรา",
  ],
  [
    "section:laem-chabang",
    21,
    "department:op2",
    "section",
    "อป.2",
    "ส่วนขายและบริการลูกค้า แหลมฉบัง",
    "แหลมฉบัง",
  ],
  [
    "section:chonburi",
    22,
    "department:op2",
    "section",
    "อป.2",
    "ส่วนขายและบริการลูกค้า ชลบุรี",
    "ชลบุรี",
  ],
  [
    "section:pattaya",
    23,
    "department:op2",
    "section",
    "อป.2",
    "ส่วนขายและบริการลูกค้า เมืองพัทยา",
    "เมืองพัทยา",
  ],
  [
    "section:map-ta-phut",
    24,
    "department:op2",
    "section",
    "อป.2",
    "ส่วนขายและบริการลูกค้า มาบตาพุด",
    "มาบตาพุด",
  ],
  [
    "section:rayong",
    25,
    "department:op2",
    "section",
    "อป.2",
    "ส่วนขายและบริการลูกค้า ระยอง",
    "ระยอง",
  ],
  ["department:op2", 26, "group:op", "department", "อป.2", null, "อป.2"],
  ["group:op", 30, null, "group", null, null, "อป."],
] as const;

const rows = rowDefinitions.map(
  ([key, sortOrder, parentKey, level, unitName, sectionName, label]) => ({
    key,
    sortOrder,
    parentKey,
    level,
    unitName,
    sectionName,
    label,
    targetConfigured: true,
    ...metrics,
  })
);

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
        scope: {
          key: "broadband",
          level: "service_group",
          businessGroup: "4.Fixed Line & Broadband",
          serviceGroup: "4.2.กลุ่มบริการ Internet Retail",
          label: "Internet Retail (Broadband)",
          reportTitle: "รายได้ Broadband",
        },
        targetPacePercent: "33.33",
        rows,
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

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("get_op_scoped_revenue_report", {
      p_year: 2026,
      p_scope_key: "broadband",
    });
    expect(result.scope).toEqual({
      key: "broadband",
      level: "service_group",
      businessGroup: "4.Fixed Line & Broadband",
      serviceGroup: "4.2.กลุ่มบริการ Internet Retail",
      label: "Internet Retail (Broadband)",
      reportTitle: "รายได้ Broadband",
    });
    expect(result.rows[11]).toMatchObject({
      label: "ระยอง",
      unitName: "อป.2",
      parentKey: "department:op2",
    });
    expect(result.organization.groupCode).toBe("อป.");
    expect(result.rows).toHaveLength(14);
    expect(result.totals.hasAllTargets).toBe(true);
  });
});
