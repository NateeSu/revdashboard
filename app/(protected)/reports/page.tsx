import { EmptyDashboard, type AvailableYear } from "@/components/dashboard/dashboard-view";
import { RevenueMatrixReport } from "@/components/reports/revenue-matrix-report";
import { createClient } from "@/lib/supabase/server";

export default async function ReportsPage({
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
  const active =
    availableYears.find((item) => item.report_year === requestedYear) ?? availableYears[0];
  const endMonth = Number(active.report_end_month.slice(5, 7));
  const requestedMonth = Number(Array.isArray(params.month) ? params.month[0] : params.month);

  return (
    <RevenueMatrixReport
      availableYears={availableYears}
      initialYear={active.report_year}
      initialMonth={requestedMonth >= 1 && requestedMonth <= endMonth ? requestedMonth : endMonth}
    />
  );
}
