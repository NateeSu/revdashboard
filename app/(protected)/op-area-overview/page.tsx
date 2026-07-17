import { EmptyDashboard } from "@/components/dashboard/dashboard-view";
import { OpAreaOverviewReport } from "@/components/reports/op-area-overview-report";
import { resolveReportingPeriod, type AvailableYear } from "@/lib/revenue/reporting-period";
import { createClient } from "@/lib/supabase/server";

export default async function OpAreaOverviewPage({
  searchParams,
}: {
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

  return <OpAreaOverviewReport availableYears={availableYears} initialYear={period.year} />;
}
