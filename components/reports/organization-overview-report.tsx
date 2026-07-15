"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CalendarRangeIcon,
  ChartColumnIcon,
  ChartPieIcon,
  CircleDollarSignIcon,
  MinusIcon,
  TrophyIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, XAxis, YAxis } from "recharts";

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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchOrganizationOverview,
  type OrganizationOverview,
} from "@/lib/query/organization-overview";
import { formatMoney, formatPercent } from "@/lib/revenue/formatters";
import {
  formatBuddhistYear,
  formatThaiMonthName,
  type AvailableYear,
} from "@/lib/revenue/reporting-period";
import { cn } from "@/lib/utils";

const groupColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];
const unmappedColor = "var(--chart-4)";

function compactMoney(value: number): string {
  return new Intl.NumberFormat("th-TH", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function ComparisonChange({ amount, percent }: { amount: string; percent: string | null }) {
  const value = Number(amount);
  const Icon = value > 0 ? ArrowUpRightIcon : value < 0 ? ArrowDownRightIcon : MinusIcon;

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-sm font-semibold tabular-nums",
        value > 0 && "text-success",
        value < 0 && "text-destructive",
        value === 0 && "text-muted-foreground"
      )}
    >
      <Icon className="size-4" />
      <span>
        {value > 0 ? "+" : ""}
        {formatMoney(amount)} บาท
      </span>
      <span className="font-normal">
        ({percent === null ? "คำนวณไม่ได้" : `${value > 0 ? "+" : ""}${formatPercent(percent)}`})
      </span>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-label="กำลังโหลดรายงาน">
      <Skeleton className="h-36" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-[420px]" />
        <Skeleton className="h-[420px]" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-72" />
        ))}
      </div>
    </div>
  );
}

function RevenueShareChart({ report }: { report: OrganizationOverview }) {
  const chartData = [
    ...report.groups.map((group, index) => ({
      key: group.code,
      label: group.label,
      revenue: Math.max(0, Number(group.currentYtdRevenue)),
      displayRevenue: group.currentYtdRevenue,
      share: group.sharePercent,
      fill: groupColors[index] ?? "var(--chart-5)",
    })),
    ...(Number(report.unmapped.currentYtdRevenue) !== 0
      ? [
          {
            key: "unmapped",
            label: "ยังไม่จัดกลุ่ม",
            revenue: Math.max(0, Number(report.unmapped.currentYtdRevenue)),
            displayRevenue: report.unmapped.currentYtdRevenue,
            share: report.unmapped.sharePercent,
            fill: unmappedColor,
          },
        ]
      : []),
  ];

  const chartConfig = Object.fromEntries(
    chartData.map((item) => [item.key, { label: item.label, color: item.fill }])
  ) satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChartPieIcon className="size-5 text-primary" />
          สัดส่วนรายได้ตามกลุ่ม
        </CardTitle>
        <CardDescription>รายได้สะสมถึงเดือนล่าสุด พร้อมสัดส่วนต่อรายได้ทั้งหมด</CardDescription>
      </CardHeader>
      <CardContent className="grid items-center gap-5 md:grid-cols-[minmax(240px,0.9fr)_1.1fr]">
        <ChartContainer
          config={chartConfig}
          className="mx-auto h-[260px] w-full max-w-[340px]"
          useResponsiveContainer={false}
        >
          <PieChart
            accessibilityLayer
            width={320}
            height={260}
            style={{ width: "100%", height: "100%" }}
          >
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="key"
                  hideLabel
                  formatter={(_value, _name, item) => (
                    <div className="flex min-w-48 items-center justify-between gap-3">
                      <span className="text-muted-foreground">{item.payload.label}</span>
                      <span className="font-mono font-semibold tabular-nums">
                        {formatMoney(item.payload.displayRevenue)} บาท
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="revenue"
              nameKey="key"
              innerRadius={62}
              outerRadius={100}
              paddingAngle={2}
              strokeWidth={2}
            >
              {chartData.map((item) => (
                <Cell key={item.key} fill={item.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        <div className="flex flex-col gap-3">
          {chartData.map((item) => (
            <div
              key={item.key}
              className="grid grid-cols-[auto_1fr] items-center gap-3 border-b pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[auto_1fr_auto]"
            >
              <span className="size-3 rounded-sm" style={{ backgroundColor: item.fill }} />
              <div className="min-w-0">
                <p className="font-medium leading-snug">{item.label}</p>
                <p className="text-xs text-muted-foreground">{formatPercent(item.share)}</p>
              </div>
              <p className="col-start-2 text-left font-mono font-semibold tabular-nums sm:col-start-auto sm:text-right">
                {formatMoney(item.displayRevenue)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">บาท</span>
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function YearComparisonChart({ report }: { report: OrganizationOverview }) {
  const chartData = report.groups.map((group) => ({
    code: group.code,
    label: group.label,
    current: Number(group.currentComparisonRevenue),
    previous: Number(group.previousComparisonRevenue),
  }));
  const chartConfig = {
    current: {
      label: `พ.ศ. ${report.reportYear + 543}`,
      color: "var(--chart-2)",
    },
    previous: {
      label: `พ.ศ. ${report.previousYear + 543}`,
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChartColumnIcon className="size-5 text-primary" />
          รายได้เทียบปีก่อนในช่วงเดียวกัน
        </CardTitle>
        <CardDescription>
          มกราคม–{formatThaiMonthName(report.reportYear, report.comparisonThroughMonth)} แยกตามกลุ่ม
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ChartContainer
          config={chartConfig}
          className="h-[270px] w-full"
          useResponsiveContainer={false}
        >
          <BarChart
            accessibilityLayer
            width={560}
            height={270}
            data={chartData}
            margin={{ left: 4, right: 4 }}
            style={{ width: "100%", height: "100%" }}
          >
            <CartesianGrid vertical={false} />
            <XAxis dataKey="code" tickLine={false} axisLine={false} tickMargin={10} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={68}
              tickFormatter={(value) => compactMoney(Number(value))}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_value, payload) => payload[0]?.payload.label}
                  formatter={(value, name) => (
                    <div className="flex min-w-52 items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        {chartConfig[name as keyof typeof chartConfig]?.label}
                      </span>
                      <span className="font-mono font-semibold tabular-nums">
                        {formatMoney(Number(value))} บาท
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Legend content={<ChartLegendContent />} />
            <Bar dataKey="previous" fill="var(--color-previous)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="current" fill="var(--color-current)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>

        <div className="grid gap-3 sm:grid-cols-3">
          {report.groups.map((group) => (
            <div key={group.code} className="flex flex-col gap-1 rounded-lg border bg-muted/45 p-3">
              <p className="font-medium">{group.label}</p>
              <p className="text-xs text-muted-foreground">ส่วนต่างจากปีก่อน</p>
              <ComparisonChange amount={group.difference} percent={group.differencePercent} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TopSections({ report }: { report: OrganizationOverview }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="top-sections-heading">
      <div>
        <h2 id="top-sections-heading" className="font-heading text-xl font-semibold">
          ส่วนงานที่มีรายได้สูงสุด 3 อันดับของแต่ละกลุ่ม
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          เรียงจากรายได้สะสมสูงสุด ภายใต้โครงสร้าง กลุ่ม → ฝ่าย → ส่วนงาน
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {report.groups.map((group) => (
          <Card key={group.code}>
            <CardHeader>
              <CardTitle>{group.label}</CardTitle>
              <CardDescription>
                รายได้กลุ่ม {formatMoney(group.currentYtdRevenue)} บาท
              </CardDescription>
              <CardAction>
                <TrophyIcon className="size-5 text-primary" />
              </CardAction>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">อันดับ</TableHead>
                    <TableHead>ส่วนงาน / ฝ่าย</TableHead>
                    <TableHead className="text-right">รายได้สะสม</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.topSections.map((section) => (
                    <TableRow key={`${section.unitName}-${section.sectionName}`}>
                      <TableCell className="text-center">
                        <Badge variant={section.rank === 1 ? "default" : "secondary"}>
                          {section.rank}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium leading-snug">{section.sectionName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          ฝ่าย {section.unitName}
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold tabular-nums">
                        {formatMoney(section.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {group.topSections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        ไม่มีรายได้ในกลุ่มนี้
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function OrganizationOverviewContent({
  report,
  selectedYear,
}: {
  report: OrganizationOverview;
  selectedYear?: AvailableYear;
}) {
  return (
    <>
      <Card className="bg-primary text-primary-foreground">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary-foreground/80">
            <CircleDollarSignIcon className="size-5" />
            รายได้สะสมทั้งหมด ถึงเดือนล่าสุด
          </CardTitle>
          <CardDescription className="text-primary-foreground/70">
            มกราคม–{formatThaiMonthName(report.reportYear, report.throughMonth)} ·
            รวมทุกฝ่ายและทุกส่วนงาน
          </CardDescription>
          <CardAction>
            <Badge variant="secondary" className="gap-1">
              <CalendarRangeIcon />
              {formatBuddhistYear(report.reportYear)}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
            {formatMoney(report.totalYtdRevenue)}
            <span className="ml-2 text-base font-medium">บาท</span>
          </p>
          <p className="mt-2 text-xs text-primary-foreground/70">
            ข้อมูลจาก Active Dataset ที่เผยแพร่ล่าสุด
            {selectedYear ? ` · ${formatBuddhistYear(selectedYear.report_year)}` : ""}
          </p>
        </CardContent>
      </Card>

      {!report.hasPreviousYear ? (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>ไม่มีข้อมูลปีก่อนสำหรับเปรียบเทียบ</AlertTitle>
          <AlertDescription>
            กราฟปีก่อนจะแสดงเป็นศูนย์ และไม่คำนวณเปอร์เซ็นต์ส่วนต่างจนกว่าจะเผยแพร่ข้อมูล{" "}
            {formatBuddhistYear(report.previousYear)}
          </AlertDescription>
        </Alert>
      ) : null}

      {Number(report.unmapped.currentYtdRevenue) !== 0 || report.unmapped.sectionCount > 0 ? (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>พบข้อมูลที่ยังไม่จัดกลุ่ม</AlertTitle>
          <AlertDescription>
            พบ {report.unmapped.sectionCount.toLocaleString("th-TH")} ส่วนงาน ยอดรวม{" "}
            {formatMoney(report.unmapped.currentYtdRevenue)} บาท ในฝ่าย{" "}
            {report.unmapped.unitNames.join(", ") || "ไม่ระบุ"} ข้อมูลนี้รวมในรายได้ทั้งหมดและ Pie
            chart แต่ไม่ถูกรวมกับกลุ่มใด กรุณากำหนด Mapping ก่อน
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-2" aria-label="กราฟภาพรวมรายได้">
        <RevenueShareChart report={report} />
        <YearComparisonChart report={report} />
      </section>

      <TopSections report={report} />
    </>
  );
}

export function OrganizationOverviewReport({
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
    queryKey: ["organization-overview", year],
    queryFn: ({ signal }) => fetchOrganizationOverview(year, signal),
  });

  const selectedYear = useMemo(
    () => availableYears.find((item) => item.report_year === year) ?? availableYears[0],
    [availableYears, year]
  );

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">ภาพรวมสายงาน ป.</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ภาพรวมรายได้ตามโครงสร้าง กลุ่ม → ฝ่าย → ส่วนงาน จากชุดข้อมูลที่เผยแพร่ล่าสุด
          </p>
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
      </div>

      {report.isError ? (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>โหลดรายงานไม่สำเร็จ</AlertTitle>
          <AlertDescription>{report.error.message}</AlertDescription>
        </Alert>
      ) : null}

      {report.isPending ? <ReportSkeleton /> : null}

      {report.data ? (
        <OrganizationOverviewContent report={report.data} selectedYear={selectedYear} />
      ) : null}
    </div>
  );
}
