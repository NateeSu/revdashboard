import { describe, expect, it } from "vitest";

import {
  millionBahtToBahtText,
  revenueTargetFormSchema,
  targetToFormValues,
} from "@/lib/targets/revenue-targets";

describe("annual revenue targets", () => {
  it("converts million baht to an exact baht decimal string", () => {
    expect(millionBahtToBahtText("26.36")).toBe("26360000.00");
    expect(millionBahtToBahtText("1,234.567891")).toBe("1234567891.00");
  });

  it("does not allow zero or negative targets", () => {
    expect(() => millionBahtToBahtText("0")).toThrow();
    expect(() => millionBahtToBahtText("-1")).toThrow();
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
      targetAmountMillion: "26.36",
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
      targetAmountMillion: "357.12",
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
        unitName: "อป.1",
        sectionName: "ส่วนขายและบริการลูกค้า ระยอง",
        serviceLevel: "all",
        businessGroup: null,
        serviceGroup: null,
        targetAmountMillion: "357.12",
      })
    ).toEqual({
      organizationLevel: "section",
      groupCode: "",
      unitName: "อป.1",
      sectionName: "ส่วนขายและบริการลูกค้า ระยอง",
      serviceLevel: "all",
      businessGroup: "",
      serviceGroup: "",
      targetAmountMillion: "357.12",
    });
  });
});
