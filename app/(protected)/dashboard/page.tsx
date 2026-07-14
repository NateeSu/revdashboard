import { DashboardView, EmptyDashboard } from "@/components/dashboard/dashboard-view";
import { resolveReportingPeriod, type AvailableYear } from "@/lib/revenue/reporting-period";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_available_years");
  if (error) throw new Error(error.message);
  const availableYears = (data ?? []) as AvailableYear[];
  if (!availableYears.length) return <EmptyDashboard />;

  const params = await searchParams;
  const requestedYear = Number(Array.isArray(params.year) ? params.year[0] : params.year);
  const requestedMonth = Number(Array.isArray(params.month) ? params.month[0] : params.month);
  const period = resolveReportingPeriod(availableYears, requestedYear, requestedMonth);

  return (
    <DashboardView
      availableYears={availableYears}
      initialYear={period.year}
      initialMonth={period.month}
    />
  );
}
