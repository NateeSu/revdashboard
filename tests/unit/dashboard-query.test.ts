import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  range: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: supabaseMocks.rpc }),
}));

import { fetchDimensionOptions } from "@/lib/query/dashboard";

function option(unitName: string, index: number) {
  return {
    unit_name: unitName,
    section_name: `ส่วนงาน ${index}`,
    cost_center: `CC-${index}`,
    business_group: `กลุ่มธุรกิจ ${index}`,
    service_group: `กลุ่มบริการ ${index}`,
    product_code: `P-${index}`,
    service_name: `บริการ ${index}`,
  };
}

describe("fetchDimensionOptions", () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockReset();
    supabaseMocks.range.mockReset();
    supabaseMocks.rpc.mockReturnValue({ range: supabaseMocks.range });
  });

  it("loads every RPC page when dimension options exceed the PostgREST row limit", async () => {
    const firstPage = Array.from({ length: 1_000 }, (_, index) => option("ตป.1", index));
    const secondPage = ["ตป.2", "นป.1", "นป.2", "อป.1", "อป.2"].map((name, index) =>
      option(name, index + 1_000)
    );
    supabaseMocks.range
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: secondPage, error: null });

    const result = await fetchDimensionOptions(2026);

    expect(supabaseMocks.rpc).toHaveBeenCalledTimes(2);
    expect(supabaseMocks.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(supabaseMocks.range).toHaveBeenNthCalledWith(2, 1_000, 1_999);
    expect(new Set(result.map((row) => row.unit_name))).toEqual(
      new Set(["ตป.1", "ตป.2", "นป.1", "นป.2", "อป.1", "อป.2"])
    );
  });
});
