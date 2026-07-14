"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { EraserIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { type AvailableYear } from "@/components/dashboard/dashboard-view";
import { MultiSelectFilter } from "@/components/filters/multi-select-filter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchDimensionOptions } from "@/lib/query/dashboard";
import { fetchRevenueMatrixReport } from "@/lib/query/reports";
import { formatMoney } from "@/lib/revenue/formatters";
import type { RevenueFilters } from "@/lib/revenue/types";
import {
  filterParamMap,
  readFilters,
  type FilterKey,
  writeFilter,
} from "@/lib/revenue/url-filters";

type DimensionOption = Awaited<ReturnType<typeof fetchDimensionOptions>>[number];

type FacetConfig = {
  key: FilterKey;
  label: string;
  field: keyof DimensionOption;
};

const serviceFacets: FacetConfig[] = [
  { key: "businessGroups", label: "กลุ่มธุรกิจ", field: "business_group" },
  { key: "serviceGroups", label: "กลุ่มบริการ", field: "service_group" },
  { key: "serviceNames", label: "รายบริการ", field: "service_name" },
];

const areaFacets: FacetConfig[] = [
  { key: "unitNames", label: "ฝ่าย", field: "unit_name" },
  { key: "sectionNames", label: "ส่วนงาน", field: "section_name" },
];

const reportFacets = [...serviceFacets, ...areaFacets];

const downstreamFilters: Partial<Record<FilterKey, FilterKey[]>> = {
  businessGroups: ["serviceGroups", "serviceNames"],
  serviceGroups: ["serviceNames"],
  unitNames: ["sectionNames"],
};

function getFacetOptions(config: FacetConfig, options: DimensionOption[], filters: RevenueFilters) {
  return Array.from(
    new Set(
      options
        .filter((row) =>
          reportFacets.every((other) => {
            if (other.key === config.key) return true;
            const selected = filters[other.key];
            return !selected?.length || selected.includes(String(row[other.field]));
          })
        )
        .map((row) => String(row[config.field]))
    )
  ).sort((a, b) => a.localeCompare(b, "th"));
}

function ReportFilterGroup({
  title,
  configs,
  options,
  filters,
  onChange,
}: {
  title: string;
  configs: FacetConfig[];
  options: DimensionOption[];
  filters: RevenueFilters;
  onChange: (key: FilterKey, values: string[]) => void;
}) {
  return (
    <section className="rounded-lg border border-amber-300 bg-[#fbfbd7] p-3">
      <h2 className="mb-3 text-sm font-medium text-slate-700">{title}</h2>
      <div
        className={
          configs.length === 3 ? "grid gap-3 lg:grid-cols-3" : "grid gap-3 lg:grid-cols-[1fr_1.3fr]"
        }
      >
        {configs.map((config) => (
          <MultiSelectFilter
            key={config.key}
            label={config.label}
            options={getFacetOptions(config, options, filters)}
            values={filters[config.key] ?? []}
            onChange={(values) => onChange(config.key, values)}
            className="h-12 w-full bg-white px-4 text-base shadow-sm"
          />
        ))}
      </div>
    </section>
  );
}

function ReportTableSkeleton({ monthCount }: { monthCount: number }) {
  return (
    <div className="space-y-2 rounded-xl border bg-white p-4">
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
      <span className="sr-only">กำลังโหลดรายงาน</span>
      <span className="sr-only">จำนวนเดือน {monthCount}</span>
    </div>
  );
}

export function RevenueMatrixReport({
  availableYears,
  initialYear,
  initialMonth,
}: {
  availableYears: AvailableYear[];
  initialYear: number;
  initialMonth: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const year = Number(searchParams.get("year") ?? initialYear);
  const month = Number(searchParams.get("month") ?? initialMonth);
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const selectedYear =
    availableYears.find((item) => item.report_year === year) ?? availableYears[0];
  const endMonth = Number(selectedYear.report_end_month.slice(5, 7));

  const dimensions = useQuery({
    queryKey: ["dimensions", year],
    queryFn: () => fetchDimensionOptions(year),
    staleTime: 5 * 60_000,
  });
  const report = useQuery({
    queryKey: ["revenue-matrix-report", year, month, JSON.stringify(filters)],
    queryFn: ({ signal }) => fetchRevenueMatrixReport({ year, month, filters, signal }),
  });

  function replace(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutator(params);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function updateFilter(key: FilterKey, values: string[]) {
    replace((params) => {
      writeFilter(params, key, values);
      for (const downstream of downstreamFilters[key] ?? []) {
        params.delete(filterParamMap[downstream]);
      }
    });
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1680px] flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            รายงานรายได้รายเดือน
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            เปรียบเทียบรายได้แยกตามส่วนงาน พร้อมยอดสะสมถึงเดือนที่เลือก
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            ปี
            <NativeSelect
              value={String(year)}
              onChange={(event) =>
                replace((params) => {
                  params.set("year", event.target.value);
                  params.delete("month");
                  for (const parameter of Object.values(filterParamMap)) params.delete(parameter);
                })
              }
            >
              {availableYears.map((item) => (
                <NativeSelectOption key={item.report_year} value={item.report_year}>
                  {item.report_year + 543}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            ถึงเดือน
            <NativeSelect
              value={String(month)}
              onChange={(event) => replace((params) => params.set("month", event.target.value))}
            >
              {Array.from({ length: endMonth }, (_, index) => index + 1).map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {new Intl.DateTimeFormat("th-TH", { month: "long" }).format(
                    new Date(year, value - 1, 1)
                  )}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <Button
            variant="outline"
            onClick={() => router.replace(`${pathname}?year=${year}&month=${month}`)}
          >
            <EraserIcon data-icon="inline-start" />
            ล้างตัวกรอง
          </Button>
        </div>
      </div>

      <div className="min-w-0 space-y-4 rounded-xl bg-[#ecece5] p-4 sm:p-5">
        <ReportFilterGroup
          title="ตั้งค่าบริการ"
          configs={serviceFacets}
          options={dimensions.data ?? []}
          filters={filters}
          onChange={updateFilter}
        />
        <ReportFilterGroup
          title="ตั้งค่าพื้นที่"
          configs={areaFacets}
          options={dimensions.data ?? []}
          filters={filters}
          onChange={updateFilter}
        />

        {dimensions.isError ? (
          <Alert variant="destructive">
            <AlertTitle>โหลดตัวเลือกไม่สำเร็จ</AlertTitle>
            <AlertDescription>{dimensions.error.message}</AlertDescription>
          </Alert>
        ) : null}
        {report.isError ? (
          <Alert variant="destructive">
            <AlertTitle>โหลดรายงานไม่สำเร็จ</AlertTitle>
            <AlertDescription>{report.error.message}</AlertDescription>
          </Alert>
        ) : null}

        {report.isPending ? (
          <ReportTableSkeleton monthCount={month} />
        ) : report.data ? (
          <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-400 bg-white shadow-sm">
            <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[980px] border-collapse text-sm tabular-nums">
                <thead>
                  <tr className="bg-[#f7cc55]">
                    <th className="sticky left-0 z-20 min-w-80 bg-[#f7cc55] px-3 py-2" />
                    <th
                      colSpan={report.data.months.length + 1}
                      className="px-3 py-2 text-right text-base font-semibold"
                    >
                      YearMonth / Revenue
                    </th>
                  </tr>
                  <tr className="border-b bg-white">
                    <th className="sticky left-0 z-20 min-w-80 bg-white px-3 py-2 text-left font-semibold">
                      ส่วนงาน
                    </th>
                    {report.data.months.map((period) => (
                      <th key={period} className="min-w-44 px-3 py-2 text-right font-medium">
                        {period}
                      </th>
                    ))}
                    <th className="sticky right-0 z-20 min-w-48 border-l bg-white px-3 py-2 text-right font-bold">
                      รายได้สะสม
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.rows.map((row, index) => (
                    <tr
                      key={row.sectionName}
                      className={index % 2 === 0 ? "bg-[#f2f2f2]" : "bg-white"}
                    >
                      <td
                        className={`sticky left-0 z-10 border-r px-3 py-2 font-medium whitespace-normal ${
                          index % 2 === 0 ? "bg-[#f2f2f2]" : "bg-white"
                        }`}
                      >
                        {row.sectionName}
                      </td>
                      {report.data.months.map((period) => (
                        <td key={period} className="border-r px-3 py-2 text-right">
                          {formatMoney(row.monthlyRevenue[period] ?? "0")}
                        </td>
                      ))}
                      <td
                        className={`sticky right-0 z-10 border-l px-3 py-2 text-right font-bold ${
                          index % 2 === 0 ? "bg-[#f2f2f2]" : "bg-white"
                        }`}
                      >
                        {formatMoney(row.ytdRevenue)}
                      </td>
                    </tr>
                  ))}
                  {report.data.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={report.data.months.length + 2}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        ไม่พบข้อมูลตามตัวกรองที่เลือก
                      </td>
                    </tr>
                  ) : null}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-white font-bold">
                    <td className="sticky left-0 z-20 border-r bg-white px-3 py-2">รายได้สะสม</td>
                    {report.data.months.map((period) => (
                      <td key={period} className="border-r px-3 py-2 text-right">
                        {formatMoney(report.data.totals.monthlyRevenue[period] ?? "0")}
                      </td>
                    ))}
                    <td className="sticky right-0 z-20 border-l bg-white px-3 py-2 text-right">
                      {formatMoney(report.data.totals.ytdRevenue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
