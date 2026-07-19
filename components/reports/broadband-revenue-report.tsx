import { OpScopedRevenueReport } from "@/components/reports/op-scoped-revenue-report";
import type { AvailableYear } from "@/lib/revenue/reporting-period";

export function BroadbandRevenueReport({
  availableYears,
  initialYear,
}: {
  availableYears: AvailableYear[];
  initialYear: number;
}) {
  return (
    <OpScopedRevenueReport
      scopeKey="broadband"
      availableYears={availableYears}
      initialYear={initialYear}
    />
  );
}
