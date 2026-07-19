"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CalendarRangeIcon,
  CableIcon,
  ChartColumnIcon,
  CircleDollarSignIcon,
  MapPinnedIcon,
  Maximize2Icon,
  Minimize2Icon,
  MinusIcon,
  NetworkIcon,
  PhoneIcon,
  RadioTowerIcon,
  TargetIcon,
  WifiIcon,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import { OpScopedRevenueExportButton } from "@/components/reports/op-scoped-revenue-export-button";
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
  fetchOpScopedRevenueOverview,
  type OpScopedRevenueOverview,
  type OpScopedRevenueRow,
} from "@/lib/query/op-scoped-revenue";
import { formatMoney, formatPercent } from "@/lib/revenue/formatters";
import {
  formatBuddhistYear,
  formatThaiMonthName,
  type AvailableYear,
} from "@/lib/revenue/reporting-period";
import {
  getOpScopedReportConfig,
  type OpRevenueScopeKey,
  type OpScopedReportConfig,
} from "@/lib/revenue/op-scoped-report-config";
import { cn } from "@/lib/utils";

const scopeIcons: Record<OpRevenueScopeKey, LucideIcon> = {
  broadband: WifiIcon,
  datacom: CableIcon,
  "fixed-line": PhoneIcon,
  "mobile-retail": RadioTowerIcon,
  "ict-solution": NetworkIcon,
};

function getChartConfig(config: OpScopedReportConfig): ChartConfig {
  return {
    previous: {
      label: "ช่วงเดียวกันปีก่อน",
      color: config.theme.previous,
    },
    current: {
      label: "รายได้สะสมปีปัจจุบัน",
      color: config.theme.current,
    },
    expectedTarget: {
      label: "เป้าหมายถึงเดือนล่าสุด",
      color: config.theme.target,
    },
  } satisfies ChartConfig;
}

function scopeCssVariables(config: OpScopedReportConfig): React.CSSProperties {
  return {
    "--scope-current": config.theme.current,
    "--scope-current-strong": config.theme.currentStrong,
    "--scope-current-soft": config.theme.currentSoft,
    "--scope-current-muted": config.theme.currentMuted,
    "--scope-previous": config.theme.previous,
    "--scope-previous-strong": config.theme.previousStrong,
    "--scope-previous-soft": config.theme.previousSoft,
    "--scope-previous-muted": config.theme.previousMuted,
    "--scope-target": config.theme.target,
    "--scope-target-strong": config.theme.targetStrong,
    "--scope-target-soft": config.theme.targetSoft,
    "--scope-target-muted": config.theme.targetMuted,
    "--scope-structure": config.theme.structure,
    "--scope-structure-soft": config.theme.structureSoft,
    "--scope-structure-muted": config.theme.structureMuted,
    "--scope-border": config.theme.border,
  } as React.CSSProperties;
}

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
  accentColor,
  accentBackground,
  borderColor,
  surfaceColor,
  footer,
}: {
  title: string;
  description: string;
  value: string;
  icon: LucideIcon;
  accentColor: string;
  accentBackground: string;
  borderColor: string;
  surfaceColor: string;
  footer?: React.ReactNode;
}) {
  return (
    <Card
      size="sm"
      className="overflow-hidden shadow-sm"
      style={{
        borderColor,
        background: `linear-gradient(135deg, #ffffff 35%, ${surfaceColor} 100%)`,
      }}
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <span
            className="flex size-9 items-center justify-center rounded-full"
            style={{ backgroundColor: accentBackground, color: accentColor }}
          >
            <Icon className="size-4.5" />
          </span>
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

function PaceBadge({ row }: { row: OpScopedRevenueRow }) {
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

function ScopedRevenueChartCard({
  title,
  description,
  rows,
  config,
}: {
  title: string;
  description: string;
  rows: OpScopedRevenueRow[];
  config: OpScopedReportConfig;
}) {
  const chartConfig = useMemo(() => getChartConfig(config), [config]);
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
    <Card
      className="shadow-sm"
      style={{ borderColor: config.theme.border }}
      aria-label={`กราฟ ${title}`}
    >
      <CardHeader
        className="border-b"
        style={{
          borderColor: config.theme.border,
          background: `linear-gradient(90deg, ${config.theme.structureSoft} 0%, #ffffff 52%, ${config.theme.currentMuted} 100%)`,
        }}
      >
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto bg-slate-50/40 pt-1">
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
                fill={config.theme.previousStrong}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontSize={11}
                fontWeight={700}
                formatter={(value) => formatMoney(Number(value))}
              />
            </Bar>
            <Bar dataKey="current" fill="var(--color-current)" radius={4} barSize={24}>
              <LabelList
                dataKey="current"
                position="top"
                fill={config.theme.currentStrong}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontSize={11}
                fontWeight={700}
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
                fill={config.theme.targetStrong}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontSize={11}
                fontWeight={700}
                formatter={(value) => formatMoney(Number(value))}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function OpScopedRevenueCharts({
  report,
  config,
}: {
  report: OpScopedRevenueOverview;
  config: OpScopedReportConfig;
}) {
  const group = report.rows.find((row) => row.level === "group");
  const op1 = report.rows.find((row) => row.key === "department:op1");
  const op2 = report.rows.find((row) => row.key === "department:op2");
  const op1Sections = report.rows.filter((row) => row.parentKey === "department:op1");
  const op2Sections = report.rows.filter((row) => row.parentKey === "department:op2");
  const allSections = report.rows.filter((row) => row.level === "section");
  const groupRows = [group, op1, op2].filter((row): row is OpScopedRevenueRow => Boolean(row));
  const op1Rows = op1 ? [op1, ...op1Sections] : op1Sections;
  const op2Rows = op2 ? [op2, ...op2Sections] : op2Sections;

  return (
    <section className="flex flex-col gap-4" aria-labelledby={`${config.key}-revenue-charts-title`}>
      <div>
        <h2
          id={`${config.key}-revenue-charts-title`}
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <ChartColumnIcon style={{ color: config.theme.current }} />
          {config.title} และเป้าหมายแยกตามพื้นที่
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          แสดงเฉพาะ{config.scopeLevel === "business_group" ? "กลุ่มธุรกิจ" : "กลุ่มบริการ"}:{" "}
          {config.scopeLabel} ด้วยกราฟแนวตั้งของช่วงเดียวกันปีก่อน รายได้สะสมปัจจุบัน
          และเป้าหมายที่ควรทำได้ถึงเดือนล่าสุด หน่วยล้านบาท
        </p>
      </div>
      <div className="grid gap-4">
        <ScopedRevenueChartCard
          title="กลุ่ม อป."
          description="ภาพรวมกลุ่มและฝ่าย อป.1–อป.2"
          rows={groupRows}
          config={config}
        />
        <ScopedRevenueChartCard
          title="ฝ่าย อป.1"
          description="ยอดรวมฝ่ายและ 5 ส่วนงานตามพื้นที่"
          rows={op1Rows}
          config={config}
        />
        <ScopedRevenueChartCard
          title="ฝ่าย อป.2"
          description="ยอดรวมฝ่ายและ 6 ส่วนงานตามพื้นที่"
          rows={op2Rows}
          config={config}
        />
        <ScopedRevenueChartCard
          title="รายส่วนงาน"
          description="เปรียบเทียบส่วนงานทั้ง 11 พื้นที่"
          rows={allSections}
          config={config}
        />
      </div>
    </section>
  );
}

function OpScopedRevenueTable({
  report,
  config,
}: {
  report: OpScopedRevenueOverview;
  config: OpScopedReportConfig;
}) {
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

  const tableContent = (
    <div
      className={cn(
        isFullscreen &&
          "fixed inset-0 z-[100] flex items-center justify-center bg-slate-50/95 p-2 backdrop-blur-sm"
      )}
      style={scopeCssVariables(config)}
      role={isFullscreen ? "dialog" : undefined}
      aria-modal={isFullscreen ? true : undefined}
      aria-label={
        isFullscreen ? `ตารางเปรียบเทียบ${config.title}รายพื้นที่แบบเต็มหน้าจอ` : undefined
      }
    >
      <Card
        className={cn(
          "w-full overflow-hidden",
          isFullscreen &&
            "aspect-video max-w-[calc(177.78svh-1.7778rem)] gap-0 rounded-lg py-0 shadow-2xl ring-1 ring-[var(--scope-border)]"
        )}
      >
        <CardHeader
          className={cn(
            "border-b border-[var(--scope-border)] bg-gradient-to-r from-[var(--scope-structure-soft)] via-white to-[var(--scope-current-muted)]",
            isFullscreen && "shrink-0 px-4 py-2"
          )}
        >
          <CardTitle className={cn(isFullscreen && "text-base")}>
            ตารางเปรียบเทียบ{config.title}รายพื้นที่
          </CardTitle>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[var(--scope-border)] bg-white text-[var(--scope-structure)] shadow-sm hover:bg-[var(--scope-structure-soft)]"
              onClick={() => setIsFullscreen((current) => !current)}
              aria-pressed={isFullscreen}
              aria-label={isFullscreen ? "ออกจากโหมดเต็มหน้าจอ" : "แสดงตารางเต็มหน้าจอ 16 ต่อ 9"}
              title={isFullscreen ? "ออกจากโหมดเต็มหน้าจอ (Esc)" : "แสดงตารางเต็มหน้าจอ 16:9"}
              data-testid={`${config.key}-table-fullscreen-toggle`}
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
              <TableRow className="border-b-2 border-[var(--scope-border)] hover:bg-transparent">
                <TableHead className="left-0 z-30 min-w-64 bg-[var(--scope-structure)] pl-4 font-semibold text-white shadow-[3px_0_0_rgba(15,23,42,0.16)]">
                  พื้นที่
                </TableHead>
                <TableHead className="bg-[var(--scope-current-soft)] text-right font-semibold text-[var(--scope-current-strong)]">
                  รายได้สะสม
                </TableHead>
                <TableHead className="bg-[var(--scope-previous-soft)] text-right font-semibold text-[var(--scope-previous-strong)]">
                  ช่วงเดียวกันปีก่อน
                </TableHead>
                <TableHead className="bg-[var(--scope-structure-soft)] text-right font-semibold text-[var(--scope-structure)]">
                  ส่วนต่างจากปีก่อน
                </TableHead>
                <TableHead className="bg-[var(--scope-target-muted)] text-right font-semibold text-[var(--scope-target-strong)]">
                  เป้าหมายทั้งปี
                </TableHead>
                <TableHead className="bg-[var(--scope-target-soft)] text-right font-semibold text-[var(--scope-target-strong)]">
                  เป้าหมายถึงเดือนล่าสุด
                </TableHead>
                <TableHead className="bg-[var(--scope-previous-soft)] text-right font-semibold text-[var(--scope-previous-strong)]">
                  เทียบเป้าทั้งปี
                </TableHead>
                <TableHead className="bg-[var(--scope-current-soft)] text-right font-semibold text-[var(--scope-current-strong)]">
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
                      isGroup && "border-y-2 border-[var(--scope-structure)]",
                      isDepartment && "border-y-2 border-[var(--scope-border)]",
                      row.level === "section" && "border-slate-200/80"
                    )}
                  >
                    <TableCell
                      className={cn(
                        "sticky left-0 z-10 min-w-64 whitespace-normal pl-4 font-medium shadow-[3px_0_0_rgba(49,46,129,0.1)]",
                        isGroup && "bg-[var(--scope-structure)] font-bold text-white",
                        isDepartment &&
                          "bg-[var(--scope-structure-soft)] font-bold text-[var(--scope-structure)]",
                        row.level === "section" &&
                          (isAlternatingSection
                            ? "bg-slate-100 text-slate-800"
                            : "bg-white text-slate-700"),
                        isGroup && isFullscreen && "bottom-0 z-30"
                      )}
                    >
                      {row.level === "section" ? row.label : `รวม ${row.label}`}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums",
                        isGroup && "bg-[var(--scope-current-strong)] font-bold text-white",
                        isDepartment &&
                          "bg-[var(--scope-current-soft)] font-bold text-[var(--scope-current-strong)]",
                        row.level === "section" &&
                          (isAlternatingSection
                            ? "bg-[var(--scope-current-soft)] font-semibold text-[var(--scope-current-strong)]"
                            : "bg-[var(--scope-current-muted)] font-semibold text-[var(--scope-current-strong)]"),
                        stickyGroupCell
                      )}
                    >
                      {formatMillionBaht(row.currentYtdRevenueBaht)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums",
                        isGroup && "bg-[var(--scope-previous-strong)] font-bold text-white",
                        isDepartment &&
                          "bg-[var(--scope-previous-soft)] font-bold text-[var(--scope-previous-strong)]",
                        row.level === "section" &&
                          (isAlternatingSection
                            ? "bg-[var(--scope-previous-soft)] text-[var(--scope-previous-strong)]"
                            : "bg-[var(--scope-previous-muted)] text-[var(--scope-previous-strong)]"),
                        stickyGroupCell
                      )}
                    >
                      {formatMillionBaht(row.previousComparisonRevenueBaht)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right",
                        isGroup && "bg-[var(--scope-structure-soft)]",
                        isDepartment && "bg-[var(--scope-structure-soft)]/75",
                        row.level === "section" &&
                          (isAlternatingSection
                            ? "bg-[var(--scope-structure-soft)]/70"
                            : "bg-[var(--scope-structure-muted)]"),
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
                        isGroup && "bg-[var(--scope-target)] font-bold text-white",
                        isDepartment &&
                          "bg-[var(--scope-target-soft)] font-bold text-[var(--scope-target-strong)]",
                        row.level === "section" &&
                          (isAlternatingSection
                            ? "bg-[var(--scope-target-soft)] text-[var(--scope-target-strong)]"
                            : "bg-[var(--scope-target-muted)] text-[var(--scope-target-strong)]"),
                        stickyGroupCell
                      )}
                    >
                      {formatMillionBaht(row.annualTargetBaht)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums",
                        isGroup && "bg-[var(--scope-target-strong)] font-bold text-white",
                        isDepartment &&
                          "bg-[var(--scope-target-soft)] font-bold text-[var(--scope-target-strong)]",
                        row.level === "section" &&
                          (isAlternatingSection
                            ? "bg-[var(--scope-target-soft)] text-[var(--scope-target-strong)]"
                            : "bg-[var(--scope-target-muted)] text-[var(--scope-target-strong)]"),
                        stickyGroupCell
                      )}
                    >
                      {formatMillionBaht(row.expectedTargetBaht)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums",
                        isGroup && "bg-[var(--scope-previous)] font-bold text-white",
                        isDepartment &&
                          "bg-[var(--scope-previous-soft)] font-bold text-[var(--scope-previous-strong)]",
                        row.level === "section" &&
                          (isAlternatingSection
                            ? "bg-[var(--scope-previous-soft)] text-[var(--scope-previous-strong)]"
                            : "bg-[var(--scope-previous-muted)] text-[var(--scope-previous-strong)]"),
                        stickyGroupCell
                      )}
                    >
                      {formatPercent(row.annualTargetPercent)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right",
                        isGroup && "bg-[var(--scope-current)] text-white",
                        isDepartment &&
                          "bg-[var(--scope-current-soft)] text-[var(--scope-current-strong)]",
                        row.level === "section" &&
                          (isAlternatingSection
                            ? "bg-[var(--scope-current-soft)]"
                            : "bg-[var(--scope-current-muted)]"),
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

  return isFullscreen ? createPortal(tableContent, document.body) : tableContent;
}

export function OpScopedRevenueOverviewContent({ report }: { report: OpScopedRevenueOverview }) {
  const config = getOpScopedReportConfig(report.scope.key);
  const currentMonth = formatThaiMonthName(report.reportYear, report.throughMonth);

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="ตัวเลขสรุป">
        <MetricCard
          title={`รายได้สะสม ${config.label}`}
          description={`มกราคม–${currentMonth}`}
          value={formatMillionBaht(report.totals.currentYtdRevenueBaht)}
          icon={CircleDollarSignIcon}
          accentColor={config.theme.currentStrong}
          accentBackground={config.theme.currentSoft}
          borderColor={config.theme.border}
          surfaceColor={config.theme.currentMuted}
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
          accentColor={config.theme.previousStrong}
          accentBackground={config.theme.previousSoft}
          borderColor={config.theme.border}
          surfaceColor={config.theme.previousMuted}
          footer={
            report.hasComparablePreviousYear ? "เปรียบเทียบช่วงเดือนเท่ากัน" : "ข้อมูลไม่ครบช่วง"
          }
        />
        <MetricCard
          title={`เป้าหมาย ${config.label} ทั้งปี`}
          description={formatBuddhistYear(report.reportYear)}
          value={formatMillionBaht(report.totals.annualTargetBaht)}
          icon={TargetIcon}
          accentColor={config.theme.targetStrong}
          accentBackground={config.theme.targetSoft}
          borderColor={config.theme.border}
          surfaceColor={config.theme.targetMuted}
          footer={`${report.totals.configuredTargetCount}/${report.totals.requiredTargetCount} ระดับมีเป้าหมาย`}
        />
        <MetricCard
          title="เป้าหมายถึงเดือนล่าสุด"
          description={`${report.targetPacePercent}% ของเป้าหมายทั้งปี`}
          value={formatMillionBaht(report.totals.expectedTargetBaht)}
          icon={ChartColumnIcon}
          accentColor={config.theme.structure}
          accentBackground={config.theme.structureSoft}
          borderColor={config.theme.border}
          surfaceColor={config.theme.structureMuted}
          footer={
            report.totals.expectedTargetPercent === null
              ? `รอการกำหนดเป้าหมาย ${config.label}`
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

      <OpScopedRevenueCharts report={report} config={config} />
      <OpScopedRevenueTable report={report} config={config} />

      <Alert>
        <TargetIcon />
        <AlertTitle>ขอบเขตการคำนวณ</AlertTitle>
        <AlertDescription>
          รายงานนี้แสดงเฉพาะพื้นที่ในสังกัด อป. เท่านั้น รายได้ทุกระดับกรองเฉพาะกลุ่มธุรกิจ{" "}
          {config.businessGroup}
          {config.serviceGroup ? ` และกลุ่มบริการ ${config.serviceGroup}` : ""}{" "}
          โครงสร้างฝ่ายและส่วนงาน ยึดความสัมพันธ์จริงในฐานข้อมูล ส่วนเป้าหมายอ่านจากรายการระดับ
          {config.scopeLevel === "business_group" ? "กลุ่มธุรกิจ" : "กลุ่มบริการ"} ของกลุ่ม อป. ฝ่าย
          หรือส่วนงานนั้นโดยตรง โดยไม่บวกเป้าหมายส่วนงานขึ้นเป็นเป้าหมายฝ่ายหรือกลุ่ม
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function OpScopedRevenueReport({
  scopeKey,
  availableYears,
  initialYear,
}: {
  scopeKey: OpRevenueScopeKey;
  availableYears: AvailableYear[];
  initialYear: number;
}) {
  const config = getOpScopedReportConfig(scopeKey);
  const ScopeIcon = scopeIcons[scopeKey];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedYear = Number(searchParams.get("year"));
  const year = availableYears.some((item) => item.report_year === requestedYear)
    ? requestedYear
    : initialYear;
  const report = useQuery({
    queryKey: ["op-scoped-revenue", scopeKey, year],
    queryFn: ({ signal }) => fetchOpScopedRevenueOverview(scopeKey, year, signal),
  });

  return (
    <div className="mx-auto flex max-w-[1700px] flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{config.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            รายได้สะสมและเป้าหมาย ·{" "}
            {config.scopeLevel === "business_group" ? "กลุ่มธุรกิจ" : "กลุ่มบริการ"}:{" "}
            {config.scopeLabel} แยกตามกลุ่ม อป. ฝ่าย อป.1–อป.2 และ 11 ส่วนงาน
            พร้อมเทียบช่วงเดียวกันปีก่อนและเป้าหมายตามเวลา
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">ขอบเขตองค์กร</span>
            <Badge
              className="h-8 px-3 hover:brightness-[0.98]"
              style={{
                borderColor: config.theme.border,
                backgroundColor: config.theme.structureSoft,
                color: config.theme.structure,
              }}
            >
              <MapPinnedIcon className="mr-1 size-3.5" /> เฉพาะพื้นที่ อป. — ภาคตะวันออก
            </Badge>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {config.scopeLevel === "business_group" ? "กลุ่มธุรกิจ" : "กลุ่มบริการ"}
            </span>
            <Badge
              className="h-8 max-w-[28rem] px-3 hover:brightness-[0.98]"
              style={{
                borderColor: config.theme.border,
                backgroundColor: config.theme.currentMuted,
                color: config.theme.currentStrong,
              }}
            >
              <ScopeIcon className="mr-1 size-3.5 shrink-0" />
              <span className="truncate">{config.scopeLabel}</span>
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
          <OpScopedRevenueExportButton report={report.data ?? null} />
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
      {report.data ? <OpScopedRevenueOverviewContent report={report.data} /> : null}
    </div>
  );
}
