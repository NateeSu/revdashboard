import { describe, expect, it } from "vitest";

import { monthOverMonth, previousMonth, sumRevenue } from "@/lib/revenue/calculations";
import { matchesRevenueFilters } from "@/lib/revenue/filters";
import { formatMoney, formatThaiMonth } from "@/lib/revenue/formatters";

describe("revenue calculations", () => {
  it("sums monthly and YTD values precisely", () => {
    expect(sumRevenue(["0.10", "0.20", null, "-0.05"])).toBe("0.25");
  });

  it("returns null for January previous month", () => {
    expect(previousMonth("202601")).toBeNull();
    expect(previousMonth("202605")).toBe("202604");
  });

  it("returns null percent when previous is zero", () => {
    expect(monthOverMonth("10.00", "0.00")).toEqual({ amount: "10.00", percent: null });
  });

  it("uses absolute previous revenue as percent denominator", () => {
    expect(monthOverMonth("-50.00", "-100.00")).toEqual({ amount: "50.00", percent: "50" });
  });
});

describe("filters and Thai formatting", () => {
  const row = {
    unitName: "หน่วย A",
    sectionName: "ส่วน A",
    costCenter: "CC01",
    businessGroup: "ธุรกิจ A",
    serviceGroup: "กลุ่ม A",
    productCode: "001",
    serviceName: "บริการ A",
  };

  it("matches exact dimensions and treats empty arrays as all", () => {
    expect(matchesRevenueFilters(row, { unitNames: [], productCodes: ["001"] })).toBe(true);
    expect(matchesRevenueFilters(row, { unitNames: ["หน่วย B"] })).toBe(false);
  });

  it("formats money with two decimals", () => {
    expect(formatMoney("1234.5")).toMatch(/1,234\.50|1,234,50/);
  });

  it("displays Buddhist Era month labels", () => {
    expect(formatThaiMonth("2026-05-01")).toContain("2569");
  });
});
