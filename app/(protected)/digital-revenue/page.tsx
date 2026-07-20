import { OpScopedRevenuePage } from "@/components/reports/op-scoped-revenue-page";

export default async function DigitalRevenuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OpScopedRevenuePage scopeKey="digital" searchParams={searchParams} />;
}
