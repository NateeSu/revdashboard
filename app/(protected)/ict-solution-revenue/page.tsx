import { OpScopedRevenuePage } from "@/components/reports/op-scoped-revenue-page";

export default async function IctSolutionRevenuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OpScopedRevenuePage scopeKey="ict-solution" searchParams={searchParams} />;
}
