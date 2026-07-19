import {
  buildOpScopedRevenueWorkbook,
  downloadOpScopedRevenueWorkbook,
  type OpScopedRevenueExportInput,
} from "@/lib/excel/op-scoped-revenue-exporter";

export type BroadbandRevenueExportInput = OpScopedRevenueExportInput;

export const buildBroadbandRevenueWorkbook = buildOpScopedRevenueWorkbook;
export const downloadBroadbandRevenueWorkbook = downloadOpScopedRevenueWorkbook;
