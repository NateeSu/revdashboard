"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CalendarRangeIcon,
  ChartColumnIcon,
  CircleDollarSignIcon,
  MapPinnedIcon,
  Maximize2Icon,
  Minimize2Icon,
  MinusIcon,
  TargetIcon,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import { OpAreaOverviewExportButton } from "@/components/reports/op-area-overview-export-button";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchOpAreaOverview,
  type OpAreaOverview,
  type OpAreaOverviewRow,
} from "@/lib/query/op-area-overview";
import { formatMoney, formatPercent } from "@/lib/revenue/formatters";
import {
  formatBuddhistYear,
  formatThaiMonthName,
  type AvailableYear,
} from "@/lib/revenue/reporting-period";
import { cn } from "@/lib/utils";

const chartConfig = {
  previous: {
    label: "ช่วงเดียวกันปีก่อน",
    color: "var(--chart-1)",
  },
  current: {
    label: "รายได้สะสมปีปัจจุบัน",
    color: "var(--chart-2)",
  },
  expectedTarget: {
    label: "เป้าหมายถึงเดือนล่าสุด",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

function millionBaht(value: string | null): number | null {
  return value === null ? null : Number(value) / 1_000_000;
}

function formatMillionBaht(value: string | null): string {
  const million = millionBaht(value);
  return million === null ? "—" : formatMoney(million);
}

function formatAxisValue(value: number): string {
  return new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: Math.abs(value) < 10 ? 1 : 0,
  }).format(value);
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

function PaceBadge({ row }: { row: OpAreaOverviewRow }) {
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
      <Skeleton className="h-[460px]" />
      <Skeleton className="h-[720px]" />
    </div>
  );
}

function AreaChartCard({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: OpAreaOverviewRow[];
}) {
  const chartData = useMemo(
    () =>
      rows.map((row) => ({
        key: row.key,
        label: row.label,
        targetConfigured: row.targetConfigured,
        previous: millionBaht(row.previousComparisonRevenueBaht),
        current: millionBaht(row.currentYtdRevenueBaht) ?? 0,
        expectedTarget: row.targetConfigured ? millionBaht(row.expectedTargetBaht) : null,
      })),
    [rows]
  );
  const chartWidth = Math.max(760, chartData.length * 150);
  const chartHeight = chartData.length > 8 ? 500 : 440;

  return (
    <Card aria-label={`กราฟ ${title}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto pt-1">
        <ChartContainer
          config={chartConfig}
          className="w-full"
          style={{ height: chartHeight, minWidth: chartWidth }}
          initialDimension={{ width: chartWidth, height: chartHeight }}
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            barGap={8}
            barCategoryGap="24%"
            margin={{ left: 0, right: 16, top: 34, bottom: 20 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              interval={0}
              height={60}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={64}
              tickFormatter={(value) => formatAxisValue(Number(value))}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value, name, item) => {
                    const key = name as keyof typeof chartConfig;
                    const targetMissing =
                      key === "expectedTarget" && !item.payload.targetConfigured;
                    return (
                      <div className="flex min-w-64 items-center justify-between gap-4">
                        <span className="text-muted-foreground">{chartConfig[key]?.label}</span>
                        <span className="font-mono font-semibold tabular-nums">
                          {targetMissing
                            ? "ยังไม่ตั้งเป้าหมาย"
                            : `${formatMoney(Number(value))} ล้านบาท`}
                        </span>
                      </div>
                    );
                  }}
                />
              }
            />
            <ChartLegend
              verticalAlign="top"
              content={<ChartLegendContent className="flex-wrap gap-x-3 gap-y-1" />}
            />
            <Bar dataKey="previous" fill="var(--color-previous)" radius={4} barSize={24}>
              <LabelList
                dataKey="previous"
                position="top"
                className="fill-foreground font-mono text-[10px]"
                formatter={(value) => formatMoney(Number(value))}
              />
            </Bar>
            <Bar dataKey="current" fill="var(--color-current)" radius={4} barSize={24}>
              <LabelList
                dataKey="current"
                position="top"
                className="fill-foreground font-mono text-[10px]"
                formatter={(value) => formatMoney(Number(value))}
              />
            </Bar>
            <Bar
              dataKey="expectedTarget"
              fill="var(--color-expectedTarget)"
              radius={4}
              barSize={24}
            >
              <LabelList
                dataKey="expectedTarget"
                position="top"
                className="fill-foreground font-mono text-[10px]"
                formatter={(value) => formatMoney(Number(value))}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function RevenueAreaCharts({ report }: { report: OpAreaOverview }) {
  const group = report.rows.find((row) => row.level === "group");
  const op1 = report.rows.find((row) => row.key === "department:op1");
  const op2 = report.rows.find((row) => row.key === "department:op2");
  const op1Sections = report.rows.filter((row) => row.parentKey === "department:op1");
  const op2Sections = report.rows.filter((row) => row.parentKey === "department:op2");
  const allSections = report.rows.filter((row) => row.level === "section");
  const groupRows = [group, op1, op2].filter((row): row is OpAreaOverviewRow => Boolean(row));
  const op1Rows = op1 ? [op1, ...op1Sections] : op1Sections;
  const op2Rows = op2 ? [op2, ...op2Sections] : op2Sections;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="revenue-area-charts-title">
      <div>
        <h2
          id="revenue-area-charts-title"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <ChartColumnIcon className="text-primary" />
          รายได้และเป้าหมายแยกตามพื้นที่
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          กราฟแนวตั้งแสดงช่วงเดียวกันปีก่อน รายได้สะสมปัจจุบัน และเป้าหมายที่ควรทำได้ถึงเดือนล่าสุด
          หน่วยล้านบาท โดยแสดงตัวเลขบนแท่งกราฟทุกชุดข้อมูล
        </p>
      </div>
      <div className="grid gap-4">
        <AreaChartCard
          title="กลุ่ม อป."
          description="ภาพรวมกลุ่มและฝ่าย อป.1–อป.2"
          rows={groupRows}
        />
        <AreaChartCard
          title="ฝ่าย อป.1"
          description="ยอดรวมฝ่ายและ 5 ส่วนงานตามพื้นที่"
          rows={op1Rows}
        />
        <AreaChartCard
          title="ฝ่าย อป.2"
          description="ยอดรวมฝ่ายและ 6 ส่วนงานตามพื้นที่"
          rows={op2Rows}
        />
        <AreaChartCard
          title="รายส่วนงาน"
          description="เปรียบเทียบส่วนงานทั้ง 11 พื้นที่"
          rows={allSections}
        />
      </div>
    </section>
  );
}

function RevenueAreaTable({ report }: { report: OpAreaOverview }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isFullscreen]);

  return (
    <div
      className={cn(
        isFullscreen &&
          "fixed inset-0 z-50 flex items-center justify-center bg-stone-100/95 p-2 backdrop-blur-sm"
      )}
      role={isFullscreen ? "dialog" : undefined}
      aria-modal={isFullscreen ? true : undefined}
      aria-label={isFullscreen ? "ตารางเปรียบเทียบรายได้รายพื้นที่แบบเต็มหน้าจอ" : undefined}
    >
      <Card
        className={cn(
          "w-full overflow-hidden",
          isFullscreen &&
            "aspect-video max-w-[calc(177.78svh-1.7778rem)] gap-0 rounded-lg py-0 shadow-2xl ring-1 ring-stone-300"
        )}
      >
        <CardHeader
          className={cn("border-b border-stone-200", isFullscreen && "shrink-0 px-4 py-2")}
        >
          <CardTitle className={cn(isFullscreen && "text-base")}>
            ตารางเปรียบเทียบรายได้รายพื้นที่
          </CardTitle>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-white text-stone-700 shadow-sm hover:bg-stone-50"
              onClick={() => setIsFullscreen((current) => !current)}
              aria-pressed={isFullscreen}
              aria-label={isFullscreen ? "ออกจากโหมดเต็มหน้าจอ" : "แสดงตารางเต็มหน้าจอ 16 ต่อ 9"}
              title={isFullscreen ? "ออกจากโหมดเต็มหน้าจอ (Esc)" : "แสดงตารางเต็มหน้าจอ 16:9"}
              data-testid="op-area-table-fullscreen-toggle"
            >
              {isFullscreen ? <Minimize2Icon /> : <Maximize2Icon />}
              {isFullscreen ? "ออกจากเต็มจอ" : "เต็มหน้าจอ 16:9"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent
          className={cn(
            "px-0",
            isFullscreen &&
              "min-h-0 flex-1 [&>[data-slot=table-container]]:h-full [&>[data-slot=table-container]]:overflow-auto"
          )}
        >
          <Table
            className={cn(
              isFullscreen
                ? "min-w-[1180px] text-[12px] leading-tight [&_td]:py-0.5 [&_th]:h-8 [&_th]:py-1"
                : "min-w-[1320px]"
            )}
          >
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20">
              <TableRow className="border-b-2 border-yellow-300 hover:bg-transparent">
                <TableHead className="left-0 z-30 min-w-64 bg-stone-200 pl-4 font-semibold text-stone-950 shadow-[3px_0_0_rgba(120,113,108,0.16)]">
                  พื้นที่
                </TableHead>
                <TableHead className="bg-yellow-100 text-right font-semibold text-yellow-950">
                  รายได้สะสม
                </TableHead>
                <TableHead className="bg-stone-200 text-right font-semibold text-stone-950">
                  ช่วงเดียวกันปีก่อน
                </TableHead>
                <TableHead className="bg-stone-100 text-right font-semibold text-stone-900">
                  ส่วนต่างจากปีก่อน
                </TableHead>
                <TableHead className="bg-amber-100 text-right font-semibold text-amber-950">
                  เป้าหมายทั้งปี
                </TableHead>
                <TableHead className="bg-yellow-200 text-right font-semibold text-yellow-950">
                  เป้าหมายถึงเดือนล่าสุด
                </TableHead>
                <TableHead className="bg-stone-200 text-right font-semibold text-stone-950">
                  เทียบเป้าทั้งปี
                </TableHead>
                <TableHead className="bg-amber-100 text-right font-semibold text-amber-950">
                  เทียบเป้าตามเวลา
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((row, index) => {
                const isGroup = row.level === "group";
                const isDepartment = row.level === "department";
                const isAlternatingSection = row.level === "section" && index % 2 === 1;
                const stickyGroupCell = isGroup && isFullscreen ? "sticky bottom-0 z-20" : "";

                return (
                  <TableRow
                    key={row.key}
                    data-row-level={row.level}
                    className={cn(
                      "hover:bg-transparent",
                      isGroup && "border-y-2 border-yellow-400",
                      isDepartment && "border-y-2 border-stone-400",
                      row.level === "section" && "border-stone-200/80"
                    )}
                  >
                    <TableCell
                      className={cn(
                        "sticky left-0 z-10 min-w-64 whitespace-normal pl-4 font-medium shadow-[3px_0_0_rgba(120,113,108,0.09)]",
                        isGroup && "bg-yellow-200 font-bold text-yellow-950",
                        isDepartment && "bg-stone-200 font-bold text-stone-950",
                        row.level === "section" &&
                          (isAlternatingSection
                            ? "bg-stone-100 text-stone-800"
                            : "bg-white text-stone-700"),
                        isGroup && isFullscreen && "bottom-0 z-30"
                      )}
                    >
                      {row.level === "section" ? row.label : `รวม ${row.label}`}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums",
                        isGroup && "bg-yellow-200 font-bold text-yellow-950",
                        isDepartment && "bg-yellow-100 font-bold text-yellow-950",
                        row.level === "section" &&
                          (isAlternatingSection
                            ? "bg-yellow-100/80 font-semibold text-yellow-950"
                            : "bg-yellow-50/80 font-semibold text-yellow-900"),
                        stickyGroupCell
                      )}
                    >
                      {formatMillionBaht(row.currentYtdRevenueBaht)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums",
                        isGroup && "bg-stone-300 font-bold text-stone-950",
                        isDepartment && "bg-stone-200 font-bold text-stone-950",
                        row.level === "section" &&
                          (isAlternatingSection
                            ? "bg-stone-200/80 text-stone-900"
                            : "bg-stone-100/80 text-stone-800"),
                        stickyGroupCell
                      )}
                    >
                      {formatMillionBaht(row.previousComparisonRevenueBaht)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right",
                        isGroup && "bg-stone-200",
                        isDepartment && "bg-stone-100",
                        row.level === "section" &&
                          (isAlternatingSection ? "bg-stone-100" : "bg-stone-50"),
                        stickyGroupCell
                      )}
                    >
                      <DifferenceValue
                        amountBaht={row.differenceBaht}
                        percent={row.differencePercent}
                      />
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums",
                        isGroup && "bg-amber-200 font-bold text-amber-950",
                        isDepartment && "bg-amber-100 font-bold text-amber-950",
                        row.level === "section" &&
                          (isAlternatingSection
                            ? "bg-amber-100/80 text-amber-950"
                            : "bg-amber-50/80 text-amber-900"),
                        stickyGroupCell
                      )}
                    >
                      {formatMillionBaht(row.annualTargetBaht)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums",
                        isGroup && "bg-yellow-300 font-bold text-yellow-950",
                        isDepartment && "bg-yellow-200 font-bold text-yellow-950",
                        row.level === "section" &&
                          (isAlternatingSection
                            ? "bg-yellow-200/70 text-yellow-950"
                            : "bg-yellow-100/70 text-yellow-900"),
                        stickyGroupCell
                      )}
                    >
                      {formatMillionBaht(row.expectedTargetBaht)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums",
                        isGroup && "bg-stone-300 font-bold text-stone-950",
                        isDepartment && "bg-stone-200 font-bold text-stone-950",
                        row.level === "section" &&
                          (isAlternatingSection
                            ? "bg-stone-200/80 text-stone-900"
                            : "bg-stone-100/80 text-stone-800"),
                        stickyGroupCell
                      )}
                    >
                      {formatPercent(row.annualTargetPercent)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right",
                        isGroup && "bg-amber-200 text-amber-950",
                        isDepartment && "bg-amber-100 text-amber-950",
                        row.level === "section" &&
                          (isAlternatingSection ? "bg-amber-100/80" : "bg-amber-50/80"),
                        stickyGroupCell
                      )}
                    >
                      <div className="flex min-w-36 flex-col items-end gap-1">
                        <PaceBadge row={row} />
                        {row.expectedTargetPercent !== null ? (
                          <span className="font-mono text-xs font-medium tabular-nums">
                            {formatPercent(row.expectedTargetPercent)} ของแผนตามเวลา
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function OpAreaOverviewContent({ report }: { report: OpAreaOverview }) {
  const currentMonth = formatThaiMonthName(report.reportYear, report.throughMonth);

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="ตัวเลขสรุป">
        <MetricCard
          title="รายได้สะสมกลุ่ม อป."
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
            report.hasComparablePreviousYear ? "เปรียบเทียบช่วงเดือนเท่ากัน" : "ข้อมูลไม่ครบช่วง"
          }
        />
        <MetricCard
          title="เป้าหมายกลุ่ม อป. ทั้งปี"
          description={formatBuddhistYear(report.reportYear)}
          value={formatMillionBaht(report.totals.annualTargetBaht)}
          icon={TargetIcon}
          footer={`${report.totals.configuredTargetCount}/${report.totals.requiredTargetCount} ระดับมีเป้าหมาย`}
        />
        <MetricCard
          title="เป้าหมายถึงเดือนล่าสุด"
          description={`${report.targetPacePercent}% ของเป้าหมายทั้งปี`}
          value={formatMillionBaht(report.totals.expectedTargetBaht)}
          icon={ChartColumnIcon}
          footer={
            report.totals.expectedTargetPercent === null
              ? "รอการกำหนดเป้าหมายกลุ่ม อป."
              : `ทำได้ ${formatPercent(report.totals.expectedTargetPercent)} ของแผนตามเวลา`
          }
        />
      </section>

      {!report.hasComparablePreviousYear ? (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>ข้อมูลปีก่อนไม่ครบช่วงสำหรับเปรียบเทียบ</AlertTitle>
          <AlertDescription>
            ระบบจะไม่แสดงส่วนต่างและเปอร์เซ็นต์ปีก่อน เพื่อป้องกันการเปรียบเทียบคนละช่วงเดือน
          </AlertDescription>
        </Alert>
      ) : null}

      {!report.totals.hasAllTargets ? (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>บางระดับยังไม่มีเป้าหมาย</AlertTitle>
          <AlertDescription>
            พบเป้าหมาย {report.totals.configuredTargetCount} จาก {report.totals.requiredTargetCount}{" "}
            ระดับ รายการที่ไม่กำหนดเป้าหมายจะแสดงเป็น “—” และไม่ถูกตีความเป็นศูนย์
          </AlertDescription>
        </Alert>
      ) : null}

      <RevenueAreaCharts report={report} />
      <RevenueAreaTable report={report} />

      <Alert>
        <TargetIcon />
        <AlertTitle>ขอบเขตการคำนวณ</AlertTitle>
        <AlertDescription>
          รายได้กลุ่ม อป. รวมเฉพาะฝ่ายที่ผูกกับ อป. ในฐานข้อมูล ฝ่ายรวมรายได้ทุกแถวของฝ่าย
          และส่วนงานจับคู่ด้วยชื่อฝ่ายกับชื่อส่วนงานจริง
          เป้าหมายของแต่ละระดับอ่านจากรายการของระดับนั้นโดยตรง
          ไม่บวกเป้าหมายส่วนงานขึ้นเป็นเป้าหมายฝ่ายหรือกลุ่ม
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function OpAreaOverviewReport({
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
    queryKey: ["op-area-overview", year],
    queryFn: ({ signal }) => fetchOpAreaOverview(year, signal),
  });

  return (
    <div className="mx-auto flex max-w-[1700px] flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            ภาพรวม อป. รายพื้นที่
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            เปรียบเทียบรายได้สะสมของกลุ่ม อป. ฝ่าย อป.1–อป.2 และ 11 ส่วนงาน กับช่วงเดียวกันปีก่อน
            เป้าหมายทั้งปี และเป้าหมายที่ควรทำได้ถึงเดือนล่าสุด
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">ขอบเขตองค์กร</span>
            <Badge variant="outline" className="h-8 px-3">
              <MapPinnedIcon className="mr-1 size-3.5" /> อป. — ภาคตะวันออก
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
          <OpAreaOverviewExportButton report={report.data ?? null} />
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
      {report.data ? <OpAreaOverviewContent report={report.data} /> : null}
    </div>
  );
}
