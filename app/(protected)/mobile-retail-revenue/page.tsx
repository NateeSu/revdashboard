import { OpScopedRevenuePage } from "@/components/reports/op-scoped-revenue-page";

export default async function MobileRetailRevenuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OpScopedRevenuePage scopeKey="mobile-retail" searchParams={searchParams} />;
}
