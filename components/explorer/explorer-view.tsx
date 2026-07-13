"use client";

import { useDeferredValue, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FilterBar, type AvailableYear } from "@/components/dashboard/dashboard-view";
import { ExportButton } from "@/components/explorer/export-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchDimensionOptions } from "@/lib/query/dashboard";
import { fetchExplorerRows, type ExplorerLevel } from "@/lib/query/explorer";
import { formatMoney, formatPercent } from "@/lib/revenue/formatters";
import { readFilters, writeFilter, type FilterKey } from "@/lib/revenue/url-filters";
import { cn } from "@/lib/utils";

const levels: Array<{ value: ExplorerLevel; label: string }> = [
  { value: "unit", label: "หน่วยงาน" },
  { value: "section", label: "ส่วนงาน" },
  { value: "business_group", label: "กลุ่มธุรกิจ" },
  { value: "service_group", label: "กลุ่มบริการ" },
  { value: "service", label: "รายบริการ" },
];

const nextLevel: Partial<Record<ExplorerLevel, ExplorerLevel>> = {
  unit: "section",
  section: "business_group",
  business_group: "service_group",
  service_group: "service",
};

export function ExplorerView({
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
  const level = (searchParams.get("level") as ExplorerLevel | null) ?? "unit";
  const search = searchParams.get("search") ?? "";
  const deferredSearch = useDeferredValue(search);
  const sortBy = searchParams.get("sort") ?? "selected_month_revenue";
  const sortDirection = searchParams.get("direction") === "asc" ? "asc" : "desc";
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
  const pageSize = [25, 50, 100].includes(Number(searchParams.get("pageSize")))
    ? Number(searchParams.get("pageSize"))
    : 50;
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const dimensions = useQuery({
    queryKey: ["dimensions", year],
    queryFn: () => fetchDimensionOptions(year),
    staleTime: 5 * 60_000,
  });
  const query = useQuery({
    queryKey: [
      "explorer",
      year,
      month,
      level,
      JSON.stringify(filters),
      deferredSearch,
      sortBy,
      sortDirection,
      page,
      pageSize,
    ],
    queryFn: ({ signal }) =>
      fetchExplorerRows({
        year,
        month,
        level,
        filters,
        search: deferredSearch || null,
        sortBy,
        sortDirection,
        page,
        pageSize,
        signal,
      }),
  });

  function replace(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutator(params);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function drill(drillFilters: Record<string, string[]>) {
    const next = nextLevel[level];
    if (!next) return;
    replace((params) => {
      for (const [key, values] of Object.entries(drillFilters))
        writeFilter(params, key as FilterKey, values);
      params.set("level", next);
      params.set("page", "1");
    });
  }

  const SortIcon = sortDirection === "asc" ? ArrowUpIcon : ArrowDownIcon;
  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">สำรวจรายได้</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            เจาะลึกจากหน่วยงานถึงรายบริการ พร้อม pagination และ sort ฝั่ง Database
          </p>
        </div>
        <ExportButton year={year} month={month} level={level} filters={filters} />
      </div>
      <FilterBar
        availableYears={availableYears}
        year={year}
        month={month}
        filters={filters}
        options={dimensions.data ?? []}
      />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          ระดับข้อมูล
          <NativeSelect
            value={level}
            onChange={(event) =>
              replace((params) => {
                params.set("level", event.target.value);
                params.set("page", "1");
              })
            }
          >
            {levels.map((item) => (
              <NativeSelectOption key={item.value} value={item.value}>
                {item.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs text-muted-foreground">
          ค้นหารายการ
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              className="pl-8"
              placeholder="ค้นหาชื่อในระดับที่เลือก"
              onChange={(event) =>
                replace((params) => {
                  if (event.target.value) params.set("search", event.target.value);
                  else params.delete("search");
                  params.set("page", "1");
                })
              }
            />
          </div>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          เรียงตาม
          <NativeSelect
            value={sortBy}
            onChange={(event) => replace((params) => params.set("sort", event.target.value))}
          >
            <NativeSelectOption value="selected_month_revenue">รายได้เดือน</NativeSelectOption>
            <NativeSelectOption value="ytd_revenue">รายได้สะสม</NativeSelectOption>
            <NativeSelectOption value="mom_amount">ผลต่าง</NativeSelectOption>
            <NativeSelectOption value="mom_percent">% เปลี่ยนแปลง</NativeSelectOption>
            <NativeSelectOption value="label">ชื่อรายการ</NativeSelectOption>
          </NativeSelect>
        </label>
        <Button
          variant="outline"
          onClick={() =>
            replace((params) => params.set("direction", sortDirection === "asc" ? "desc" : "asc"))
          }
        >
          <SortIcon data-icon="inline-start" />
          {sortDirection === "asc" ? "น้อยไปมาก" : "มากไปน้อย"}
        </Button>
      </div>
      <Breadcrumb>
        <BreadcrumbList>
          {levels
            .slice(0, levels.findIndex((item) => item.value === level) + 1)
            .map((item, index, visible) => (
              <span key={item.value} className="contents">
                <BreadcrumbItem>
                  {index === visible.length - 1 ? (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  ) : (
                    <button
                      className="hover:text-foreground"
                      onClick={() =>
                        replace((params) => {
                          params.set("level", item.value);
                          params.set("page", "1");
                        })
                      }
                    >
                      {item.label}
                    </button>
                  )}
                </BreadcrumbItem>
                {index < visible.length - 1 ? <BreadcrumbSeparator /> : null}
              </span>
            ))}
        </BreadcrumbList>
      </Breadcrumb>

      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>โหลดข้อมูลไม่สำเร็จ</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{levels.find((item) => item.value === level)?.label}</CardTitle>
          <CardDescription>
            {query.data
              ? `ทั้งหมด ${query.data.totalItems.toLocaleString("th-TH")} รายการ`
              : "กำลังโหลดข้อมูล"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {query.isPending ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className="h-10" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รายการ</TableHead>
                  <TableHead className="text-right">รายได้เดือน</TableHead>
                  <TableHead className="text-right">รายได้สะสม</TableHead>
                  <TableHead className="text-right">เดือนก่อน</TableHead>
                  <TableHead className="text-right">ผลต่าง</TableHead>
                  <TableHead className="text-right">% เปลี่ยนแปลง</TableHead>
                  <TableHead className="text-right">สัดส่วน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data?.items.map((item) => (
                  <TableRow
                    key={item.key}
                    className={cn(nextLevel[level] && "cursor-pointer")}
                    onClick={() => drill(item.drillFilters)}
                  >
                    <TableCell className="max-w-md whitespace-normal font-medium">
                      {item.label}
                      {nextLevel[level] ? (
                        <ChevronRightIcon className="ml-1 inline size-4 text-muted-foreground" />
                      ) : level === "service" ? (
                        <span className="mt-1 block text-xs font-normal text-muted-foreground">
                          {item.productCode} · {item.costCenter}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMoney(item.selectedMonthRevenue)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMoney(item.ytdRevenue)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMoney(item.previousMonthRevenue)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono",
                        Number(item.momAmount ?? 0) < 0 && "text-destructive"
                      )}
                    >
                      {formatMoney(item.momAmount)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatPercent(item.momPercent)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatPercent(item.sharePercent)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {query.data ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                แถวต่อหน้า
                <NativeSelect
                  size="sm"
                  value={String(pageSize)}
                  onChange={(event) =>
                    replace((params) => {
                      params.set("pageSize", event.target.value);
                      params.set("page", "1");
                    })
                  }
                >
                  {[25, 50, 100].map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {value}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  หน้า {query.data.page} / {Math.max(query.data.totalPages, 1)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => replace((params) => params.set("page", String(page - 1)))}
                >
                  ก่อนหน้า
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= query.data.totalPages}
                  onClick={() => replace((params) => params.set("page", String(page + 1)))}
                >
                  ถัดไป
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
