"use client";

import { OpScopedRevenueExportButton } from "@/components/reports/op-scoped-revenue-export-button";
import type { BroadbandRevenueOverview } from "@/lib/query/broadband-revenue";

export function BroadbandRevenueExportButton({
  report,
}: {
  report: BroadbandRevenueOverview | null;
}) {
  return <OpScopedRevenueExportButton report={report} />;
}
