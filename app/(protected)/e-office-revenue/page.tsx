import { OpScopedRevenuePage } from "@/components/reports/op-scoped-revenue-page";

export default async function EOfficeRevenuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OpScopedRevenuePage scopeKey="e-office" searchParams={searchParams} />;
}
