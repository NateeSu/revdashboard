import type { RevenueFilters } from "@/lib/revenue/types";

export const filterParamMap = {
  unitNames: "unit",
  sectionNames: "section",
  costCenters: "costCenter",
  businessGroups: "business",
  serviceGroups: "serviceGroup",
  productCodes: "product",
  serviceNames: "service",
} as const;

export type FilterKey = keyof typeof filterParamMap;

export function readFilters(searchParams: URLSearchParams): RevenueFilters {
  return Object.fromEntries(
    Object.entries(filterParamMap).flatMap(([key, param]) => {
      const values = searchParams.getAll(param).filter(Boolean);
      return values.length ? [[key, values]] : [];
    })
  ) as RevenueFilters;
}

export function writeFilter(params: URLSearchParams, key: FilterKey, values: readonly string[]) {
  const parameter = filterParamMap[key];
  params.delete(parameter);
  values.forEach((value) => params.append(parameter, value));
}
