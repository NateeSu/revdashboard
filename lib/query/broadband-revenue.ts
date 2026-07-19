import {
  fetchOpScopedRevenueOverview,
  type OpScopedRevenueOverview,
  type OpScopedRevenueRow,
} from "@/lib/query/op-scoped-revenue";

export type BroadbandRevenueRow = OpScopedRevenueRow;
export type BroadbandRevenueOverview = OpScopedRevenueOverview;

export function fetchBroadbandRevenueOverview(
  year: number,
  signal?: AbortSignal
): Promise<BroadbandRevenueOverview> {
  return fetchOpScopedRevenueOverview("broadband", year, signal);
}
