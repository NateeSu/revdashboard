import type { RevenueFilterable, RevenueFilters } from "@/lib/revenue/types";

function allows(values: readonly string[] | undefined, value: string) {
  return !values?.length || values.includes(value);
}

export function matchesRevenueFilters(row: RevenueFilterable, filters: RevenueFilters): boolean {
  return (
    allows(filters.unitNames, row.unitName) &&
    allows(filters.sectionNames, row.sectionName) &&
    allows(filters.costCenters, row.costCenter) &&
    allows(filters.businessGroups, row.businessGroup) &&
    allows(filters.serviceGroups, row.serviceGroup) &&
    allows(filters.productCodes, row.productCode) &&
    allows(filters.serviceNames, row.serviceName)
  );
}
