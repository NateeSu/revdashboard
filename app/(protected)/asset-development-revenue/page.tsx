import { OpScopedRevenuePage } from "@/components/reports/op-scoped-revenue-page";

export default async function AssetDevelopmentRevenuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OpScopedRevenuePage scopeKey="asset-development" searchParams={searchParams} />;
}
