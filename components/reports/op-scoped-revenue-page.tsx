import { EmptyDashboard } from "@/components/dashboard/dashboard-view";
import { OpScopedRevenueReport } from "@/components/reports/op-scoped-revenue-report";
import type { OpRevenueScopeKey } from "@/lib/revenue/op-scoped-report-config";
import { resolveReportingPeriod, type AvailableYear } from "@/lib/revenue/reporting-period";
import { createClient } from "@/lib/supabase/server";

export async function OpScopedRevenuePage({
  scopeKey,
  searchParams,
}: {
  scopeKey: OpRevenueScopeKey;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { data, error } = await (await createClient()).rpc("get_available_years");
  if (error) throw new Error(error.message);

  const availableYears = (data ?? []) as AvailableYear[];
  if (!availableYears.length) return <EmptyDashboard />;

  const params = await searchParams;
  const requestedYear = Number(Array.isArray(params.year) ? params.year[0] : params.year);
  const preferredYear = availableYears.some((item) => item.report_year === 2026)
    ? 2026
    : requestedYear;
  const period = resolveReportingPeriod(availableYears, preferredYear);

  return (
    <OpScopedRevenueReport
      scopeKey={scopeKey}
      availableYears={availableYears}
      initialYear={period.year}
    />
  );
}
