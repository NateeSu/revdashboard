"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CalendarRangeIcon,
  ChartColumnIcon,
  CircleDollarSignIcon,
  MinusIcon,
  TargetIcon,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { OpServiceOverviewExportButton } from "@/components/reports/op-service-overview-export-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchOpServiceOverview,
  type OpServiceOverview,
  type OpServiceOverviewRow,
} from "@/lib/query/op-service-overview";
import { formatMoney, formatPercent } from "@/lib/revenue/formatters";
import {
  formatBuddhistYear,
  formatThaiMonthName,
  type AvailableYear,
} from "@/lib/revenue/reporting-period";
import { cn } from "@/lib/utils";

const chartConfig = {
  current: {
    label: "รายได้สะสมปีปัจจุบัน",
    color: "var(--chart-2)",
  },
  previous: {
    label: "ช่วงเดียวกันปีก่อน",
    color: "var(--chart-1)",
  },
  expectedTarget: {
    label: "เป้าหมายถึงเดือนล่าสุด",
    color: "var(--chart-3)",
  },
  annualTarget: {
    label: "เป้าหมายทั้งปี",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

function millionBaht(value: string | null): number | null {
  return value === null ? null : Number(value) / 1_000_000;
}

function formatMillionBaht(value: string | null): string {
  const million = millionBaht(value);
  return million === null ? "—" : formatMoney(million);
}

function MetricCard({
  title,
  description,
  value,
  icon: Icon,
  footer,
}: {
  title: string;
  description: string;
  value: string;
  icon: LucideIcon;
  footer?: React.ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Icon className="text-primary" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="font-mono text-2xl font-bold tracking-tight tabular-nums">
          {value}
          {value !== "—" ? (
            <span className="ml-1 text-xs font-normal text-muted-foreground">ล้านบาท</span>
          ) : null}
        </p>
        {footer ? <div className="text-xs text-muted-foreground">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

function DifferenceValue({
  amountBaht,
  percent,
  showUnit = false,
}: {
  amountBaht: string | null;
  percent: string | null;
  showUnit?: boolean;
}) {
  if (amountBaht === null) return <span className="text-muted-foreground">—</span>;
  const amount = Number(amountBaht);
  const Icon = amount > 0 ? ArrowUpRightIcon : amount < 0 ? ArrowDownRightIcon : MinusIcon;

  return (
    <div
      className={cn(
        "flex items-center justify-end gap-1 font-mono text-xs font-semibold tabular-nums",
        amount > 0 && "text-success",
        amount < 0 && "text-destructive",
        amount === 0 && "text-muted-foreground"
      )}
    >
      <Icon className="size-3.5" />
      <span>
        {amount > 0 ? "+" : ""}
        {formatMillionBaht(amountBaht)}
        {showUnit ? " ลบ." : ""}
      </span>
      {percent !== null ? (
        <span className="font-sans font-normal">
          ({amount > 0 ? "+" : ""}
          {formatPercent(percent)})
        </span>
      ) : null}
    </div>
  );
}

function PaceBadge({ row }: { row: OpServiceOverviewRow }) {
  if (!row.targetConfigured || row.expectedTargetPercent === null) {
    return <Badge variant="outline">ยังไม่ตั้งเป้าหมาย</Badge>;
  }
  const percent = Number(row.expectedTargetPercent);
  if (percent >= 100) return <Badge variant="success">ตามหรือสูงกว่าแผน</Badge>;
  if (percent >= 90) return <Badge variant="warning">ใกล้เคียงแผน</Badge>;
  return <Badge variant="destructive">ต่ำกว่าแผน</Badge>;
}

function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-label="กำลังโหลดรายงาน">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-[720px]" />
      <Skeleton className="h-[640px]" />
    </div>
  );
}

function RevenueComparisonChart({ report }: { report: OpServiceOverview }) {
  const chartData = useMemo(
    () =>
      report.rows.map((row) => ({
        key: row.key,
        label: row.label,
        chartLabel: row.level === "service_group" ? `↳ ${row.label}` : row.label,
        targetConfigured: row.targetConfigured,
        current: millionBaht(row.currentYtdRevenueBaht) ?? 0,
        previous: millionBaht(row.previousComparisonRevenueBaht) ?? 0,
        expectedTarget: millionBaht(row.expectedTargetBaht) ?? 0,
        annualTarget: millionBaht(row.annualTargetBaht) ?? 0,
      })),
    [report.rows]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChartColumnIcon className="text-primary" />
          รายได้และเป้าหมายรายบริการ
        </CardTitle>
        <CardDescription>
          ตัวเลขหน่วยล้านบาท · รายได้ถึง
          {formatThaiMonthName(report.reportYear, report.throughMonth)} ·
          แถวเยื้องเป็นรายละเอียดกลุ่มบริการ
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <ChartContainer
          config={chartConfig}
          className="h-[680px] min-w-[1100px] w-full"
          initialDimension={{ width: 1100, height: 680 }}
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{ left: 12, right: 28, top: 6, bottom: 8 }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) =>
                new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Number(value))
              }
            />
            <YAxis
              type="category"
              dataKey="chartLabel"
              tickLine={false}
              axisLine={false}
              width={330}
              tickMargin={8}
              interval={0}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_value, payload) => payload[0]?.payload.label}
                  formatter={(value, name, item) => {
                    const key = name as keyof typeof chartConfig;
                    const isTarget = key === "annualTarget" || key === "expectedTarget";
                    const hasTarget = Boolean(item.payload.targetConfigured);
                    return (
                      <div className="flex min-w-64 items-center justify-between gap-4">
                        <span className="text-muted-foreground">{chartConfig[key]?.label}</span>
                        <span className="font-mono font-semibold tabular-nums">
                          {isTarget && !hasTarget
                            ? "ยังไม่ตั้งเป้าหมาย"
                            : `${formatMoney(Number(value))} ล้านบาท`}
                        </span>
                      </div>
                    );
                  }}
                />
              }
            />
            <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
            <Bar dataKey="previous" fill="var(--color-previous)" radius={3} />
            <Bar dataKey="current" fill="var(--color-current)" radius={3} />
            <Bar dataKey="expectedTarget" fill="var(--color-expectedTarget)" radius={3} />
            <Bar dataKey="annualTarget" fill="var(--color-annualTarget)" radius={3} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function RevenueComparisonTable({ report }: { report: OpServiceOverview }) {
  const totalRow: OpServiceOverviewRow = {
    key: "total",
    sortOrder: 999,
    parentKey: null,
    level: "business_group",
    businessGroup: "รวม",
    serviceGroup: null,
    label: "รวม (เฉพาะกลุ่มธุรกิจ)",
    targetConfigured: report.totals.annualTargetBaht !== null,
    ...report.totals,
  };

  const renderPace = (row: OpServiceOverviewRow) => (
    <div className="flex min-w-36 flex-col items-end gap-1">
      <PaceBadge row={row} />
      {row.expectedTargetVarianceBaht !== null ? (
        <span
          className={cn(
            "font-mono text-xs tabular-nums",
            Number(row.expectedTargetVarianceBaht) >= 0 ? "text-success" : "text-destructive"
          )}
        >
          {Number(row.expectedTargetVarianceBaht) >= 0 ? "สูงกว่า" : "ต่ำกว่า"}{" "}
          {formatMillionBaht(String(Math.abs(Number(row.expectedTargetVarianceBaht))))} ลบ.
        </span>
      ) : null}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>ตารางเปรียบเทียบรายได้รายบริการ</CardTitle>
        <CardDescription>
          ยอดรวมด้านล่างนับเฉพาะกลุ่มธุรกิจ จึงไม่บวกยอดกลุ่มบริการที่เป็นรายละเอียดซ้ำอีกครั้ง
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Table className="min-w-[1320px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-80 pl-4">กลุ่มธุรกิจ / กลุ่มบริการ</TableHead>
              <TableHead className="text-right">รายได้สะสม</TableHead>
              <TableHead className="text-right">ช่วงเดียวกันปีก่อน</TableHead>
              <TableHead className="text-right">ส่วนต่างจากปีก่อน</TableHead>
              <TableHead className="text-right">เป้าหมายทั้งปี</TableHead>
              <TableHead className="text-right">เป้าหมายถึงเดือนล่าสุด</TableHead>
              <TableHead className="text-right">เทียบเป้าทั้งปี</TableHead>
              <TableHead className="text-right">เทียบเป้าตามเวลา</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.map((row) => (
              <TableRow
                key={row.key}
                className={row.level === "service_group" ? "bg-muted/35" : undefined}
              >
                <TableCell
                  className={cn(
                    "min-w-80 whitespace-normal pl-4 font-medium leading-snug",
                    row.level === "service_group" && "pl-10 font-normal text-muted-foreground"
                  )}
                >
                  {row.level === "service_group" ? "↳ " : ""}
                  {row.label}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums">
                  {formatMillionBaht(row.currentYtdRevenueBaht)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatMillionBaht(row.previousComparisonRevenueBaht)}
                </TableCell>
                <TableCell className="text-right">
                  <DifferenceValue
                    amountBaht={row.differenceBaht}
                    percent={row.differencePercent}
                  />
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatMillionBaht(row.annualTargetBaht)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatMillionBaht(row.expectedTargetBaht)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatPercent(row.annualTargetPercent)}
                </TableCell>
                <TableCell className="text-right">{renderPace(row)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="whitespace-normal pl-4 font-semibold">
                {totalRow.label}
              </TableCell>
              <TableCell className="text-right font-mono font-bold tabular-nums">
                {formatMillionBaht(totalRow.currentYtdRevenueBaht)}
              </TableCell>
              <TableCell className="text-right font-mono font-bold tabular-nums">
                {formatMillionBaht(totalRow.previousComparisonRevenueBaht)}
              </TableCell>
              <TableCell className="text-right">
                <DifferenceValue
                  amountBaht={totalRow.differenceBaht}
                  percent={totalRow.differencePercent}
                />
              </TableCell>
              <TableCell className="text-right font-mono font-bold tabular-nums">
                {formatMillionBaht(totalRow.annualTargetBaht)}
              </TableCell>
              <TableCell className="text-right font-mono font-bold tabular-nums">
                {formatMillionBaht(totalRow.expectedTargetBaht)}
              </TableCell>
              <TableCell className="text-right font-mono font-bold tabular-nums">
                {formatPercent(totalRow.annualTargetPercent)}
              </TableCell>
              <TableCell className="text-right">{renderPace(totalRow)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}

export function OpServiceOverviewContent({ report }: { report: OpServiceOverview }) {
  const currentMonth = formatThaiMonthName(report.reportYear, report.throughMonth);

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="ตัวเลขสรุป">
        <MetricCard
          title="รายได้สะสมปีปัจจุบัน"
          description={`มกราคม–${currentMonth}`}
          value={formatMillionBaht(report.totals.currentYtdRevenueBaht)}
          icon={CircleDollarSignIcon}
          footer={
            <DifferenceValue
              amountBaht={report.totals.differenceBaht}
              percent={report.totals.differencePercent}
              showUnit
            />
          }
        />
        <MetricCard
          title="ช่วงเดียวกันปีก่อน"
          description={`${formatBuddhistYear(report.previousYear)} · ถึงเดือนเดียวกัน`}
          value={formatMillionBaht(report.totals.previousComparisonRevenueBaht)}
          icon={CalendarRangeIcon}
          footer={
            report.hasComparablePreviousYear ? "ใช้ช่วงเดือนเดียวกับปีปัจจุบัน" : "ข้อมูลไม่ครบช่วง"
          }
        />
        <MetricCard
          title="เป้าหมายทั้งปี"
          description={formatBuddhistYear(report.reportYear)}
          value={formatMillionBaht(report.totals.annualTargetBaht)}
          icon={TargetIcon}
          footer={`${report.totals.configuredTargetCount}/${report.totals.requiredTargetCount} กลุ่มธุรกิจมีเป้าหมาย`}
        />
        <MetricCard
          title="เป้าหมายถึงเดือนล่าสุด"
          description={`${report.targetPacePercent}% ของเป้าหมายทั้งปี`}
          value={formatMillionBaht(report.totals.expectedTargetBaht)}
          icon={ChartColumnIcon}
          footer={
            report.totals.expectedTargetPercent === null
              ? "รอการกำหนดเป้าหมาย"
              : `ทำได้ ${formatPercent(report.totals.expectedTargetPercent)} ของเป้าหมายตามเวลา`
          }
        />
      </section>

      {!report.hasComparablePreviousYear ? (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>ข้อมูลปีก่อนไม่ครบช่วงสำหรับเปรียบเทียบ</AlertTitle>
          <AlertDescription>
            ระบบไม่แสดงส่วนต่างและเปอร์เซ็นต์ปีก่อน เพื่อป้องกันการเปรียบเทียบคนละช่วงเดือน
          </AlertDescription>
        </Alert>
      ) : null}

      {!report.totals.hasAllBusinessGroupTargets ? (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>เป้าหมายกลุ่มธุรกิจยังไม่ครบ</AlertTitle>
          <AlertDescription>
            พบเป้าหมาย {report.totals.configuredTargetCount} จาก {report.totals.requiredTargetCount}{" "}
            กลุ่มธุรกิจ ยอดรวมเป้าหมายจะแสดงเฉพาะรายการที่กำหนดไว้
            และรายการที่ยังไม่กำหนดไม่ถูกนับเป็นศูนย์
          </AlertDescription>
        </Alert>
      ) : null}

      <RevenueComparisonChart report={report} />
      <RevenueComparisonTable report={report} />

      <Alert>
        <TargetIcon />
        <AlertTitle>วิธีคำนวณเป้าหมายตามเวลา</AlertTitle>
        <AlertDescription>
          เป้าหมายถึงเดือนล่าสุด = เป้าหมายทั้งปี × {report.throughMonth} ÷ 12 หรือ{" "}
          {report.targetPacePercent}% ของเป้าหมายทั้งปี
          ส่วนยอดรวมจะนับเฉพาะกลุ่มธุรกิจเพื่อไม่ให้ซ้ำกับรายละเอียดกลุ่มบริการ
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function OpServiceOverviewReport({
  availableYears,
  initialYear,
}: {
  availableYears: AvailableYear[];
  initialYear: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedYear = Number(searchParams.get("year"));
  const year = availableYears.some((item) => item.report_year === requestedYear)
    ? requestedYear
    : initialYear;
  const report = useQuery({
    queryKey: ["op-service-overview", year],
    queryFn: ({ signal }) => fetchOpServiceOverview(year, signal),
  });

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            ภาพรวม อป. รายบริการ
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            เปรียบเทียบรายได้สะสมของ อป. กับช่วงเดียวกันปีก่อน เป้าหมายทั้งปี
            และเป้าหมายที่ควรทำได้ถึงเดือนล่าสุด
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">ขอบเขตองค์กร</span>
            <Badge variant="outline" className="h-8 px-3">
              อป. — ภาคตะวันออก
            </Badge>
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            ปีรายงาน
            <NativeSelect
              value={String(year)}
              onChange={(event) =>
                router.replace(`${pathname}?year=${event.target.value}`, { scroll: false })
              }
            >
              {availableYears.map((item) => (
                <NativeSelectOption key={item.report_year} value={item.report_year}>
                  {formatBuddhistYear(item.report_year)} · ถึง
                  {formatThaiMonthName(item.report_year, Number(item.report_end_month.slice(5, 7)))}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <OpServiceOverviewExportButton report={report.data ?? null} />
        </div>
      </div>

      {report.isError ? (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>โหลดรายงานไม่สำเร็จ</AlertTitle>
          <AlertDescription>{report.error.message}</AlertDescription>
        </Alert>
      ) : null}

      {report.isPending ? <ReportSkeleton /> : null}
      {report.data ? <OpServiceOverviewContent report={report.data} /> : null}
    </div>
  );
}
