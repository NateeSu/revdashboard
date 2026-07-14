import { describe, expect, it } from "vitest";

import { formatReportPeriodRange, getReportFilterDetails } from "@/lib/revenue/report-scope";

describe("report scope", () => {
  it("describes the selected values for every supported report filter", () => {
    const details = getReportFilterDetails({
      businessGroups: ["กลุ่มธุรกิจ A"],
      sectionNames: ["ส่วนงาน 1", "ส่วนงาน 2"],
    });

    expect(details).toHaveLength(7);
    expect(details.find((detail) => detail.key === "businessGroups")?.values).toEqual([
      "กลุ่มธุรกิจ A",
    ]);
    expect(details.find((detail) => detail.key === "sectionNames")?.values).toEqual([
      "ส่วนงาน 1",
      "ส่วนงาน 2",
    ]);
    expect(details.find((detail) => detail.key === "serviceGroups")?.values).toEqual([]);
  });

  it("formats the visible reporting period in Buddhist years", () => {
    expect(formatReportPeriodRange(2025, 12)).toBe("มกราคม–ธันวาคม พ.ศ. 2568");
    expect(formatReportPeriodRange(2026, 1)).toBe("มกราคม พ.ศ. 2569");
  });
});
