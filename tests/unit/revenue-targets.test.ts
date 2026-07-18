import { describe, expect, it } from "vitest";

import {
  revenueTargetAmountToBahtText,
  revenueTargetFormSchema,
  targetToFormValues,
} from "@/lib/targets/revenue-targets";

describe("annual revenue targets", () => {
  it("converts million baht to an exact baht decimal string", () => {
    expect(revenueTargetAmountToBahtText("26.36", "million_baht")).toBe("26360000.00");
    expect(revenueTargetAmountToBahtText("1,234.567891", "million_baht")).toBe("1234567891.00");
  });

  it("accepts baht input without scaling and rounds to satang", () => {
    expect(revenueTargetAmountToBahtText("26,360,000", "baht")).toBe("26360000.00");
    expect(revenueTargetAmountToBahtText("26,360,000.125", "baht")).toBe("26360000.13");
  });

  it("does not allow zero or negative targets", () => {
    expect(() => revenueTargetAmountToBahtText("0", "baht")).toThrow();
    expect(() => revenueTargetAmountToBahtText("-1", "million_baht")).toThrow();
  });

  it("accepts a sparse group and business target without requiring other dimensions", () => {
    const result = revenueTargetFormSchema.safeParse({
      organizationLevel: "group",
      groupCode: "อป.",
      unitName: "",
      sectionName: "",
      serviceLevel: "business_group",
      businessGroup: "Digital",
      serviceGroup: "",
      targetAmountUnit: "million_baht",
      targetAmount: "26.36",
    });

    expect(result.success).toBe(true);
  });

  it("requires the parent dimension for a section and service group target", () => {
    const result = revenueTargetFormSchema.safeParse({
      organizationLevel: "section",
      groupCode: "",
      unitName: "",
      sectionName: "ส่วนขายและบริการลูกค้า ระยอง",
      serviceLevel: "service_group",
      businessGroup: "",
      serviceGroup: "Cloud",
      targetAmountUnit: "baht",
      targetAmount: "357,120,000",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(["unitName", "businessGroup"])
      );
    }
  });

  it("maps nullable database dimensions back to editable form values", () => {
    expect(
      targetToFormValues({
        organizationLevel: "section",
        groupCode: null,
        unitName: "อป.2",
        sectionName: "ส่วนขายและบริการลูกค้า ระยอง",
        serviceLevel: "all",
        businessGroup: null,
        serviceGroup: null,
        targetAmountBaht: "357120000.00",
      })
    ).toEqual({
      organizationLevel: "section",
      groupCode: "",
      unitName: "อป.2",
      sectionName: "ส่วนขายและบริการลูกค้า ระยอง",
      serviceLevel: "all",
      businessGroup: "",
      serviceGroup: "",
      targetAmountUnit: "million_baht",
      targetAmount: "357.12",
    });
  });

  it("maps the exact stored baht value to million baht without two-decimal truncation", () => {
    const values = targetToFormValues({
      organizationLevel: "group",
      groupCode: "อป.",
      unitName: null,
      sectionName: null,
      serviceLevel: "all",
      businessGroup: null,
      serviceGroup: null,
      targetAmountBaht: "1.23",
    });

    expect(values.targetAmountUnit).toBe("million_baht");
    expect(values.targetAmount).toBe("0.00000123");
  });
});
