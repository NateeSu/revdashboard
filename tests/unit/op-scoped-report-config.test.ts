import { describe, expect, it } from "vitest";

import {
  OP_REVENUE_SCOPE_KEYS,
  OP_SCOPED_REPORT_CONFIGS,
} from "@/lib/revenue/op-scoped-report-config";

describe("OP scoped revenue report configuration", () => {
  it("defines a unique route and visual identity for every requested report", () => {
    const configs = OP_REVENUE_SCOPE_KEYS.map((key) => OP_SCOPED_REPORT_CONFIGS[key]);

    expect(configs.map((config) => config.route)).toEqual([
      "/broadband-revenue",
      "/datacom-revenue",
      "/fixed-line-revenue",
      "/mobile-retail-revenue",
      "/ict-solution-revenue",
      "/digital-revenue",
      "/asset-development-revenue",
      "/e-office-revenue",
    ]);
    expect(new Set(configs.map((config) => config.route)).size).toBe(configs.length);
    expect(new Set(configs.map((config) => config.theme.current)).size).toBe(configs.length);
    expect(
      configs.filter((config) => config.displayUnit === "baht").map((config) => config.key)
    ).toEqual(["e-office"]);
  });

  it("uses the canonical database dimensions for each service and business group", () => {
    expect(OP_SCOPED_REPORT_CONFIGS.datacom).toMatchObject({
      scopeLevel: "service_group",
      businessGroup: "4.Fixed Line & Broadband",
      serviceGroup: "4.3.กลุ่มบริการวงจรเช่า (Datacom)",
    });
    expect(OP_SCOPED_REPORT_CONFIGS["fixed-line"]).toMatchObject({
      scopeLevel: "service_group",
      businessGroup: "4.Fixed Line & Broadband",
      serviceGroup: "4.4.บริการโทรศัพท์ประจำที่ (Fixed Line)",
    });
    expect(OP_SCOPED_REPORT_CONFIGS["mobile-retail"]).toMatchObject({
      scopeLevel: "service_group",
      businessGroup: "3.Mobile",
      serviceGroup: "3.2.บริการโทรคมนาคมสื่อสารไร้สาย - กลุ่มค้าปลีก (Retail)",
    });
    expect(OP_SCOPED_REPORT_CONFIGS["ict-solution"]).toMatchObject({
      scopeLevel: "business_group",
      businessGroup: "6.ICT Solution",
      serviceGroup: null,
      serviceName: null,
    });
    expect(OP_SCOPED_REPORT_CONFIGS.digital).toMatchObject({
      scopeLevel: "business_group",
      businessGroup: "5.Digital",
      serviceGroup: null,
      serviceName: null,
    });
    expect(OP_SCOPED_REPORT_CONFIGS["asset-development"]).toMatchObject({
      scopeLevel: "service_group",
      businessGroup: "1.Hard Infrastructure",
      serviceGroup: "1.4.กลุ่มบริการพัฒนาสินทรัพย์",
      serviceName: null,
    });
    expect(OP_SCOPED_REPORT_CONFIGS["e-office"]).toMatchObject({
      scopeLevel: "service",
      businessGroup: "5.Digital",
      serviceGroup: "5.4.กลุ่มบริการ Application & Digital Services",
      serviceName: "บริการ e-Office",
      displayUnit: "baht",
    });
  });
});
