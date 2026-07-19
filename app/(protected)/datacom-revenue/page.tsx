import { OpScopedRevenuePage } from "@/components/reports/op-scoped-revenue-page";

export default async function DatacomRevenuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OpScopedRevenuePage scopeKey="datacom" searchParams={searchParams} />;
}
