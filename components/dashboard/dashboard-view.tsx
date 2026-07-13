"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  AlertCircleIcon,
  CircleDollarSignIcon,
  EraserIcon,
  InfoIcon,
  MinusIcon,
  ReceiptTextIcon,
  TrendingUpIcon,
  WalletCardsIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { MultiSelectFilter } from "@/components/filters/multi-select-filter";
import { ExportButton } from "@/components/explorer/export-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchDashboardData, fetchDimensionOptions } from "@/lib/query/dashboard";
import { formatMoney, formatPercent } from "@/lib/revenue/formatters";
import type { RevenueFilters } from "@/lib/revenue/types";
import {
  filterParamMap,
  readFilters,
  type FilterKey,
  writeFilter,
} from "@/lib/revenue/url-filters";
import { cn } from "@/lib/utils";

export type AvailableYear = {
  report_year: number;
  active_batch_id: string;
  report_end_month: string;
  current_month_revenue: string;
  ytd_revenue: string;
};

type DimensionOption = Awaited<ReturnType<typeof fetchDimensionOptions>>[number];

const dimensionConfig: Array<{ key: FilterKey; label: string; field: keyof DimensionOption }> = [
  { key: "unitNames", label: "หน่วยงาน", field: "unit_name" },
  { key: "sectionNames", label: "ส่วนงาน", field: "section_name" },
  { key: "costCenters", label: "ศูนย์ต้นทุน", field: "cost_center" },
  { key: "businessGroups", label: "กลุ่มธุรกิจ", field: "business_group" },
  { key: "serviceGroups", label: "กลุ่มบริการ", field: "service_group" },
  { key: "productCodes", label: "รหัสผลิตภัณฑ์", field: "product_code" },
  { key: "serviceNames", label: "รายบริการ", field: "service_name" },
];

const chartConfig = {
  revenue: { label: "รายได้", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function FilterBar({
  availableYears,
  year,
  month,
  filters,
  options,
}: {
  availableYears: AvailableYear[];
  year: number;
  month: number;
  filters: RevenueFilters;
  options: DimensionOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedYear =
    availableYears.find((item) => item.report_year === year) ?? availableYears[0];
  const endMonth = Number(selectedYear.report_end_month.slice(5, 7));

  function replace(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutator(params);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function updateFilter(key: FilterKey, values: string[]) {
    replace((params) => {
      writeFilter(params, key, values);
      const index = dimensionConfig.findIndex((item) => item.key === key);
      dimensionConfig.slice(index + 1).forEach((item) => params.delete(filterParamMap[item.key]));
    });
  }

  function availableOptions(index: number) {
    const parentConfigs = dimensionConfig.slice(0, index);
    return Array.from(
      new Set(
        options
          .filter((row) =>
            parentConfigs.every((parent) => {
              const selected = filters[parent.key];
              return !selected?.length || selected.includes(String(row[parent.field]));
            })
          )
          .map((row) => String(row[dimensionConfig[index].field]))
      )
    ).sort((a, b) => a.localeCompare(b, "th"));
  }

  return (
    <section
      className="flex flex-wrap items-end gap-2 rounded-lg border p-3"
      aria-label="ตัวกรองรายงาน"
    >
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        ปี
        <NativeSelect
          value={String(year)}
          onChange={(event) =>
            replace((params) => {
              params.set("year", event.target.value);
              params.delete("month");
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
        เดือน
        <NativeSelect
          value={String(month)}
          onChange={(event) => replace((params) => params.set("month", event.target.value))}
        >
          {Array.from({ length: endMonth }, (_, index) => index + 1).map((value) => (
            <NativeSelectOption key={value} value={value}>
              {new Intl.DateTimeFormat("th-TH", { month: "long" }).format(
                new Date(2026, value - 1, 1)
              )}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>
      {dimensionConfig.map((config, index) => (
        <MultiSelectFilter
          key={config.key}
          label={config.label}
          options={availableOptions(index)}
          values={filters[config.key] ?? []}
          onChange={(values) => updateFilter(config.key, values)}
        />
      ))}
      <Button
        variant="ghost"
        onClick={() => router.replace(`${pathname}?year=${year}&month=${month}`, { scroll: false })}
      >
        <EraserIcon data-icon="inline-start" />
        ล้างตัวกรอง
      </Button>
    </section>
  );
}

export function KpiCard({
  label,
  value,
  description,
  direction,
  danger,
}: {
  label: string;
  value: string;
  description: string;
  direction?: "up" | "down" | "flat";
  danger?: boolean;
}) {
  const Icon =
    direction === "up" ? ArrowUpRightIcon : direction === "down" ? ArrowDownRightIcon : MinusIcon;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
        <CardAction>
          <Tooltip>
            <TooltipTrigger
              render={<span className="grid size-6 place-items-center text-muted-foreground" />}
            >
              <InfoIcon />
            </TooltipTrigger>
            <TooltipContent>{description}</TooltipContent>
          </Tooltip>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "font-mono text-xl font-semibold tabular-nums",
            danger && "text-destructive"
          )}
        >
          {value}
        </div>
        {direction ? (
          <div
            className={cn(
              "mt-1 flex items-center gap-1 text-xs",
              direction === "down" ? "text-destructive" : "text-success"
            )}
          >
            <Icon className="size-3" />
            เทียบเดือนก่อน
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-28" />
      ))}
    </div>
  );
}

export function DashboardView({
  availableYears,
  initialYear,
  initialMonth,
}: {
  availableYears: AvailableYear[];
  initialYear: number;
  initialMonth: number;
}) {
  const searchParams = useSearchParams();
  const year = Number(searchParams.get("year") ?? initialYear);
  const month = Number(searchParams.get("month") ?? initialMonth);
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const filterKey = JSON.stringify(filters);
  const dimensions = useQuery({
    queryKey: ["dimensions", year],
    queryFn: () => fetchDimensionOptions(year),
    staleTime: 5 * 60_000,
  });
  const dashboard = useQuery({
    queryKey: ["dashboard", year, month, filterKey],
    queryFn: ({ signal }) => fetchDashboardData(year, month, filters, signal),
  });

  if (dashboard.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>โหลดข้อมูล Dashboard ไม่สำเร็จ</AlertTitle>
        <AlertDescription>{dashboard.error.message}</AlertDescription>
      </Alert>
    );
  }

  const data = dashboard.data;
  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">ภาพรวมรายได้</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            รายได้เดือนที่เลือกและสะสมตั้งแต่มกราคม ภายใต้ Active Dataset
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton year={year} month={month} level="service" filters={filters} />
          <Button
            render={<Link href={`/explorer?year=${year}&month=${month}`} />}
            nativeButton={false}
            variant="outline"
          >
            <TrendingUpIcon data-icon="inline-start" />
            สำรวจรายละเอียด
          </Button>
        </div>
      </div>
      <FilterBar
        availableYears={availableYears}
        year={year}
        month={month}
        filters={filters}
        options={dimensions.data ?? []}
      />

      {Object.values(filters).flat().length ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">ตัวกรอง:</span>
          {Object.entries(filters).flatMap(
            ([key, values]) =>
              values?.map((value) => (
                <Badge key={`${key}-${value}`} variant="outline">
                  {value}
                </Badge>
              )) ?? []
          )}
        </div>
      ) : null}

      {!data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <KpiCard
              label="รายได้เดือนที่เลือก"
              value={`${formatMoney(data.kpis.selectedMonthRevenue)} บาท`}
              description="ผลรวมรายได้ของเดือนที่เลือก"
            />
            <KpiCard
              label="รายได้สะสม"
              value={`${formatMoney(data.kpis.ytdRevenue)} บาท`}
              description="ผลรวมตั้งแต่มกราคมถึงเดือนที่เลือก"
            />
            <KpiCard
              label="รายได้เดือนก่อน"
              value={`${formatMoney(data.kpis.previousMonthRevenue)} บาท`}
              description="เดือนก่อนหน้าในปีเดียวกัน"
            />
            <KpiCard
              label="เปลี่ยนแปลงจากเดือนก่อน"
              value={`${formatMoney(data.kpis.momAmount)} บาท`}
              description="เดือนที่เลือก ลบ เดือนก่อน"
              direction={
                Number(data.kpis.momAmount ?? 0) > 0
                  ? "up"
                  : Number(data.kpis.momAmount ?? 0) < 0
                    ? "down"
                    : "flat"
              }
            />
            <KpiCard
              label="บริการที่มีรายได้"
              value={`${data.kpis.activeServiceCount.toLocaleString("th-TH")} รายการ`}
              description="บริการที่ยอดไม่ว่างและไม่เป็นศูนย์"
            />
            <KpiCard
              label="รายการรายได้ติดลบ"
              value={`${data.kpis.negativeRecordCount.toLocaleString("th-TH")} รายการ`}
              description={`รวม ${formatMoney(data.kpis.negativeRevenueAmount)} บาท`}
              danger={data.kpis.negativeRecordCount > 0}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
            <Card>
              <CardHeader>
                <CardTitle>แนวโน้มรายได้รายเดือน</CardTitle>
                <CardDescription>มกราคมถึงเดือนที่เลือก</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-72 w-full">
                  <LineChart
                    accessibilityLayer
                    data={data.trend.map((item) => ({
                      month: item.period_month.slice(5, 7),
                      revenue: Number(item.revenue),
                    }))}
                    margin={{ left: 12, right: 12 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value: number) => `${Math.round(value / 1_000_000)}M`}
                      width={52}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => (
                            <span className="font-mono">{formatMoney(Number(value))} บาท</span>
                          )}
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--color-revenue)"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>รายได้ตามหน่วยงาน</CardTitle>
                <CardDescription>เรียงจากมากไปน้อย</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-72 w-full">
                  <BarChart
                    accessibilityLayer
                    data={data.units.map((item) => ({
                      label: item.group_label,
                      revenue: Number(item.selected_month_revenue),
                    }))}
                    layout="vertical"
                    margin={{ left: 20 }}
                  >
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      width={74}
                      tick={{ fontSize: 11 }}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => (
                            <span className="font-mono">{formatMoney(Number(value))} บาท</span>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={3} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>กลุ่มบริการที่มีรายได้สูงสุด 10 อันดับ</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>กลุ่มบริการ</TableHead>
                      <TableHead className="text-right">เดือนที่เลือก</TableHead>
                      <TableHead className="text-right">สัดส่วน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.serviceGroups.map((item) => (
                      <TableRow key={item.group_key}>
                        <TableCell className="max-w-96 whitespace-normal">
                          {item.group_label}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(item.selected_month_revenue)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatPercent(item.share_percent)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>รายบริการสูงสุด 10 อันดับ</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>รายบริการ</TableHead>
                      <TableHead className="text-right">เดือนที่เลือก</TableHead>
                      <TableHead className="text-right">สะสม</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.services.map((item) => (
                      <TableRow key={item.group_key}>
                        <TableCell className="max-w-96 whitespace-normal">
                          {item.group_label}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(item.selected_month_revenue)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(item.ytd_revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>รายการรายได้ติดลบ</CardTitle>
              <CardDescription>
                รายการปรับปรุง/คืนเงิน/ยกเลิกที่ติดลบมากที่สุด 10 รายการ
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.negativeRows.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>หน่วยงาน</TableHead>
                      <TableHead>กลุ่มบริการ</TableHead>
                      <TableHead>รายบริการ</TableHead>
                      <TableHead className="text-right">รายได้</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.negativeRows.map((row) => (
                      <TableRow key={row.record_key}>
                        <TableCell>{row.unit_name}</TableCell>
                        <TableCell className="max-w-80 whitespace-normal">
                          {row.service_group}
                        </TableCell>
                        <TableCell className="max-w-80 whitespace-normal">
                          {row.service_name}
                        </TableCell>
                        <TableCell className="text-right font-mono text-destructive">
                          {formatMoney(row.revenue_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ReceiptTextIcon />
                    </EmptyMedia>
                    <EmptyTitle>ไม่พบรายการรายได้ติดลบ</EmptyTitle>
                    <EmptyDescription>
                      ไม่มีรายการติดลบภายใต้ตัวกรองและเดือนที่เลือก
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>สรุปรายได้ตามหน่วยงาน</CardTitle>
              <CardDescription>คลิกชื่อหน่วยงานเพื่อเจาะลึกใน Revenue Explorer</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>หน่วยงาน</TableHead>
                    <TableHead className="text-right">เดือนที่เลือก</TableHead>
                    <TableHead className="text-right">สะสม</TableHead>
                    <TableHead className="text-right">เดือนก่อน</TableHead>
                    <TableHead className="text-right">ผลต่าง</TableHead>
                    <TableHead className="text-right">% เปลี่ยนแปลง</TableHead>
                    <TableHead className="text-right">สัดส่วน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.units.map((item) => (
                    <TableRow key={item.group_key}>
                      <TableCell>
                        <Link
                          className="font-medium text-primary hover:underline"
                          href={`/explorer?year=${year}&month=${month}&unit=${encodeURIComponent(item.group_label)}`}
                        >
                          {item.group_label}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(item.selected_month_revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(item.ytd_revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(item.previous_month_revenue)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono",
                          Number(item.mom_amount ?? 0) < 0 && "text-destructive"
                        )}
                      >
                        {formatMoney(item.mom_amount)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPercent(item.mom_percent)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPercent(item.share_percent)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export function EmptyDashboard() {
  return (
    <Empty className="min-h-[60svh]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <WalletCardsIcon />
        </EmptyMedia>
        <EmptyTitle>ยังไม่มีชุดข้อมูลที่เผยแพร่</EmptyTitle>
        <EmptyDescription>
          นำเข้าไฟล์รายได้ชุดแรก ตรวจสอบข้อมูล และกดเผยแพร่เพื่อเริ่มใช้งาน Dashboard
        </EmptyDescription>
      </EmptyHeader>
      <Button render={<Link href="/upload" />} nativeButton={false}>
        <CircleDollarSignIcon data-icon="inline-start" />
        นำเข้าไฟล์แรก
      </Button>
    </Empty>
  );
}
