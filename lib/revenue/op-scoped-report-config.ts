import type { RevenueDisplayUnit } from "@/lib/revenue/display-money";

export const OP_REVENUE_SCOPE_KEYS = [
  "broadband",
  "datacom",
  "fixed-line",
  "mobile-retail",
  "ict-solution",
  "digital",
  "asset-development",
  "e-office",
] as const;

export type OpRevenueScopeKey = (typeof OP_REVENUE_SCOPE_KEYS)[number];
export type OpRevenueScopeLevel = "business_group" | "service_group" | "service";

export type OpScopedReportTheme = {
  current: string;
  currentStrong: string;
  currentSoft: string;
  currentMuted: string;
  previous: string;
  previousStrong: string;
  previousSoft: string;
  previousMuted: string;
  target: string;
  targetStrong: string;
  targetSoft: string;
  targetMuted: string;
  structure: string;
  structureSoft: string;
  structureMuted: string;
  border: string;
};

export type OpScopedReportConfig = {
  key: OpRevenueScopeKey;
  route: string;
  title: string;
  label: string;
  scopeLabel: string;
  scopeLevel: OpRevenueScopeLevel;
  businessGroup: string;
  serviceGroup: string | null;
  serviceName: string | null;
  displayUnit: RevenueDisplayUnit;
  theme: OpScopedReportTheme;
};

export const OP_SCOPED_REPORT_CONFIGS: Record<OpRevenueScopeKey, OpScopedReportConfig> = {
  broadband: {
    key: "broadband",
    route: "/broadband-revenue",
    title: "รายได้ Broadband",
    label: "Broadband",
    scopeLabel: "Internet Retail (Broadband)",
    scopeLevel: "service_group",
    businessGroup: "4.Fixed Line & Broadband",
    serviceGroup: "4.2.กลุ่มบริการ Internet Retail",
    serviceName: null,
    displayUnit: "million-baht",
    theme: {
      current: "#0F9CA6",
      currentStrong: "#0F766E",
      currentSoft: "#CCFBF1",
      currentMuted: "#F0FDFA",
      previous: "#8B5CF6",
      previousStrong: "#6D28D9",
      previousSoft: "#EDE9FE",
      previousMuted: "#F5F3FF",
      target: "#F97316",
      targetStrong: "#C2410C",
      targetSoft: "#FED7AA",
      targetMuted: "#FFF7ED",
      structure: "#1E1B4B",
      structureSoft: "#E0E7FF",
      structureMuted: "#F8FAFC",
      border: "#A5B4FC",
    },
  },
  datacom: {
    key: "datacom",
    route: "/datacom-revenue",
    title: "รายได้ Datacom",
    label: "Datacom",
    scopeLabel: "กลุ่มบริการวงจรเช่า (Datacom)",
    scopeLevel: "service_group",
    businessGroup: "4.Fixed Line & Broadband",
    serviceGroup: "4.3.กลุ่มบริการวงจรเช่า (Datacom)",
    serviceName: null,
    displayUnit: "million-baht",
    theme: {
      current: "#0284C7",
      currentStrong: "#0369A1",
      currentSoft: "#BAE6FD",
      currentMuted: "#F0F9FF",
      previous: "#0D9488",
      previousStrong: "#0F766E",
      previousSoft: "#CCFBF1",
      previousMuted: "#F0FDFA",
      target: "#D97706",
      targetStrong: "#B45309",
      targetSoft: "#FDE68A",
      targetMuted: "#FFFBEB",
      structure: "#0C4A6E",
      structureSoft: "#E0F2FE",
      structureMuted: "#F8FAFC",
      border: "#7DD3FC",
    },
  },
  "fixed-line": {
    key: "fixed-line",
    route: "/fixed-line-revenue",
    title: "รายได้ Fixed Line",
    label: "Fixed Line",
    scopeLabel: "บริการโทรศัพท์ประจำที่ (Fixed Line)",
    scopeLevel: "service_group",
    businessGroup: "4.Fixed Line & Broadband",
    serviceGroup: "4.4.บริการโทรศัพท์ประจำที่ (Fixed Line)",
    serviceName: null,
    displayUnit: "million-baht",
    theme: {
      current: "#E11D48",
      currentStrong: "#BE123C",
      currentSoft: "#FECDD3",
      currentMuted: "#FFF1F2",
      previous: "#64748B",
      previousStrong: "#475569",
      previousSoft: "#E2E8F0",
      previousMuted: "#F8FAFC",
      target: "#CA8A04",
      targetStrong: "#A16207",
      targetSoft: "#FEF08A",
      targetMuted: "#FEFCE8",
      structure: "#4C0519",
      structureSoft: "#FFE4E6",
      structureMuted: "#F8FAFC",
      border: "#FDA4AF",
    },
  },
  "mobile-retail": {
    key: "mobile-retail",
    route: "/mobile-retail-revenue",
    title: "รายได้ Mobile Retail",
    label: "Mobile Retail",
    scopeLabel: "กลุ่มบริการโทรคมนาคมสื่อสารไร้สาย - กลุ่มค้าปลีก (Retail)",
    scopeLevel: "service_group",
    businessGroup: "3.Mobile",
    serviceGroup: "3.2.บริการโทรคมนาคมสื่อสารไร้สาย - กลุ่มค้าปลีก (Retail)",
    serviceName: null,
    displayUnit: "million-baht",
    theme: {
      current: "#059669",
      currentStrong: "#047857",
      currentSoft: "#A7F3D0",
      currentMuted: "#ECFDF5",
      previous: "#2563EB",
      previousStrong: "#1D4ED8",
      previousSoft: "#BFDBFE",
      previousMuted: "#EFF6FF",
      target: "#C026D3",
      targetStrong: "#A21CAF",
      targetSoft: "#F5D0FE",
      targetMuted: "#FDF4FF",
      structure: "#064E3B",
      structureSoft: "#D1FAE5",
      structureMuted: "#F8FAFC",
      border: "#6EE7B7",
    },
  },
  "ict-solution": {
    key: "ict-solution",
    route: "/ict-solution-revenue",
    title: "รายได้ ICT-Solution",
    label: "ICT-Solution",
    scopeLabel: "กลุ่มธุรกิจ ICT Solution",
    scopeLevel: "business_group",
    businessGroup: "6.ICT Solution",
    serviceGroup: null,
    serviceName: null,
    displayUnit: "million-baht",
    theme: {
      current: "#7C3AED",
      currentStrong: "#6D28D9",
      currentSoft: "#DDD6FE",
      currentMuted: "#F5F3FF",
      previous: "#0891B2",
      previousStrong: "#0E7490",
      previousSoft: "#CFFAFE",
      previousMuted: "#ECFEFF",
      target: "#F59E0B",
      targetStrong: "#D97706",
      targetSoft: "#FDE68A",
      targetMuted: "#FFFBEB",
      structure: "#312E81",
      structureSoft: "#E0E7FF",
      structureMuted: "#F8FAFC",
      border: "#A5B4FC",
    },
  },
  digital: {
    key: "digital",
    route: "/digital-revenue",
    title: "รายได้ Digital",
    label: "Digital",
    scopeLabel: "กลุ่มธุรกิจ Digital",
    scopeLevel: "business_group",
    businessGroup: "5.Digital",
    serviceGroup: null,
    serviceName: null,
    displayUnit: "million-baht",
    theme: {
      current: "#DB2777",
      currentStrong: "#BE185D",
      currentSoft: "#FBCFE8",
      currentMuted: "#FDF2F8",
      previous: "#4F46E5",
      previousStrong: "#4338CA",
      previousSoft: "#C7D2FE",
      previousMuted: "#EEF2FF",
      target: "#F59E0B",
      targetStrong: "#B45309",
      targetSoft: "#FDE68A",
      targetMuted: "#FFFBEB",
      structure: "#831843",
      structureSoft: "#FCE7F3",
      structureMuted: "#FFF7FB",
      border: "#F9A8D4",
    },
  },
  "asset-development": {
    key: "asset-development",
    route: "/asset-development-revenue",
    title: "รายได้พัฒนาสินทรัพย์",
    label: "พัฒนาสินทรัพย์",
    scopeLabel: "กลุ่มบริการพัฒนาสินทรัพย์",
    scopeLevel: "service_group",
    businessGroup: "1.Hard Infrastructure",
    serviceGroup: "1.4.กลุ่มบริการพัฒนาสินทรัพย์",
    serviceName: null,
    displayUnit: "million-baht",
    theme: {
      current: "#65A30D",
      currentStrong: "#4D7C0F",
      currentSoft: "#D9F99D",
      currentMuted: "#F7FEE7",
      previous: "#0891B2",
      previousStrong: "#0E7490",
      previousSoft: "#CFFAFE",
      previousMuted: "#ECFEFF",
      target: "#EA580C",
      targetStrong: "#C2410C",
      targetSoft: "#FED7AA",
      targetMuted: "#FFF7ED",
      structure: "#365314",
      structureSoft: "#ECFCCB",
      structureMuted: "#FAFFF2",
      border: "#BEF264",
    },
  },
  "e-office": {
    key: "e-office",
    route: "/e-office-revenue",
    title: "รายได้ e-Office",
    label: "e-Office",
    scopeLabel: "บริการ e-Office",
    scopeLevel: "service",
    businessGroup: "5.Digital",
    serviceGroup: "5.4.กลุ่มบริการ Application & Digital Services",
    serviceName: "บริการ e-Office",
    displayUnit: "baht",
    theme: {
      current: "#9333EA",
      currentStrong: "#7E22CE",
      currentSoft: "#E9D5FF",
      currentMuted: "#FAF5FF",
      previous: "#DB2777",
      previousStrong: "#BE185D",
      previousSoft: "#FBCFE8",
      previousMuted: "#FDF2F8",
      target: "#0D9488",
      targetStrong: "#0F766E",
      targetSoft: "#99F6E4",
      targetMuted: "#F0FDFA",
      structure: "#4C1D95",
      structureSoft: "#EDE9FE",
      structureMuted: "#FAF8FF",
      border: "#C4B5FD",
    },
  },
};

export function getOpScopedReportConfig(scopeKey: OpRevenueScopeKey): OpScopedReportConfig {
  return OP_SCOPED_REPORT_CONFIGS[scopeKey];
}
