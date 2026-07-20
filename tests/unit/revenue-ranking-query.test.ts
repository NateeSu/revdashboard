import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRevenueRankingSourceReport } from "@/tests/fixtures/revenue-ranking-source";

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  abortSignal: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: supabaseMocks.rpc }),
}));

import { buildRevenueRankingReport, fetchRevenueRanking } from "@/lib/query/revenue-ranking";

describe("revenue ranking query", () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockReset();
    supabaseMocks.abortSignal.mockReset();
    supabaseMocks.rpc.mockReturnValue({ abortSignal: supabaseMocks.abortSignal });
  });

  it("uses the OP area report and ranks current revenue inside each configured group", async () => {
    supabaseMocks.abortSignal.mockResolvedValue({
      data: createRevenueRankingSourceReport(),
      error: null,
    });

    const report = await fetchRevenueRanking(2026);

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("get_op_area_overview_report", {
      p_year: 2026,
    });
    expect(report.groups.map((group) => [group.label, group.rows.length])).toEqual([
      ["Super Demander", 4],
      ["Star Champion", 4],
      ["Rising Star", 3],
    ]);
    expect(report.groups[0].rows.map((row) => [row.label, row.rank])).toEqual([
      ["ระยอง", 1],
      ["แหลมฉบัง", 2],
      ["ชลบุรี", 3],
      ["จันทบุรี", 4],
    ]);
    expect(report.groups[1].rows.find((row) => row.label === "พัทยา")).toMatchObject({
      unitName: "อป.2",
      sectionName: "ส่วนขายและบริการลูกค้า เมืองพัทยา",
      rank: 3,
    });
  });

  it("rejects a source report when one required ranking area is missing", () => {
    const source = createRevenueRankingSourceReport();
    source.rows = source.rows.filter((row) => row.sectionName !== "ส่วนขายและบริการลูกค้า ระยอง");

    expect(() => buildRevenueRankingReport(source)).toThrow(
      "RANKING_AREA_NOT_FOUND:ส่วนขายและบริการลูกค้า ระยอง"
    );
  });
});
