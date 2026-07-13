import {
  DashboardView,
  EmptyDashboard,
  type AvailableYear,
} from "@/components/dashboard/dashboard-view";
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
  const fallback = availableYears[0];
  const requestedYear = Number(Array.isArray(params.year) ? params.year[0] : params.year);
  const active = availableYears.find((item) => item.report_year === requestedYear) ?? fallback;
  const requestedMonth = Number(Array.isArray(params.month) ? params.month[0] : params.month);
  const endMonth = Number(active.report_end_month.slice(5, 7));
  const initialMonth =
    requestedMonth >= 1 && requestedMonth <= endMonth ? requestedMonth : endMonth;

  return (
    <DashboardView
      availableYears={availableYears}
      initialYear={active.report_year}
      initialMonth={initialMonth}
    />
  );
}
