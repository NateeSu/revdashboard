"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CalendarRangeIcon,
  MapPinnedIcon,
  Maximize2Icon,
  Minimize2Icon,
  MinusIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { RevenueRankingExportButton } from "@/components/reports/revenue-ranking-export-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  fetchRevenueRanking,
  type RevenueRankingGroup,
  type RevenueRankingReport as RevenueRankingReportData,
  type RevenueRankingRow,
} from "@/lib/query/revenue-ranking";
import { formatMoney, formatPercent } from "@/lib/revenue/formatters";
import {
  formatBuddhistYear,
  formatThaiMonthName,
  type AvailableYear,
} from "@/lib/revenue/reporting-period";
import type { RevenueRankingGroupKey } from "@/lib/revenue/ranking-groups";
import { cn } from "@/lib/utils";

const groupStyles: Record<RevenueRankingGroupKey, { group: string; area: string; accent: string }> =
  {
    "super-demander": {
      group: "bg-amber-100 text-slate-950",
      area: "bg-amber-50/85",
      accent: "border-amber-500",
    },
    "star-champion": {
      group: "bg-slate-200 text-slate-950",
      area: "bg-slate-100/90",
      accent: "border-slate-600",
    },
    "rising-star": {
      group: "bg-yellow-100 text-slate-950",
      area: "bg-yellow-50/85",
      accent: "border-yellow-500",
    },
  };

function millionBaht(value: string | null): number | null {
  return value === null ? null : Number(value) / 1_000_000;
}

function formatMillionBaht(value: string | null): string {
  const million = millionBaht(value);
  return million === null ? "—" : formatMoney(million);
}

function Difference({
  row,
}: {
  row: Pick<RevenueRankingRow, "differenceBaht" | "differencePercent">;
}) {
  if (row.differenceBaht === null) return <span className="text-slate-400">—</span>;
  const difference = Number(row.differenceBaht);
  const Icon = difference > 0 ? ArrowUpRightIcon : difference < 0 ? ArrowDownRightIcon : MinusIcon;

  return (
    <div
      className={cn(
        "flex items-center justify-end gap-1 font-mono font-semibold tabular-nums",
        difference > 0 && "text-emerald-700",
        difference < 0 && "text-red-700",
        difference === 0 && "text-slate-500"
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>
        {difference > 0 ? "+" : ""}
        {formatMillionBaht(row.differenceBaht)}
      </span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full border font-mono text-sm font-extrabold tabular-nums shadow-sm",
        rank === 1
          ? "border-amber-600 bg-amber-400 text-slate-950"
          : "border-slate-400 bg-white text-slate-700"
      )}
      aria-label={`อันดับ ${rank}`}
    >
      {rank}
    </span>
  );
}

function RankingRows({ group }: { group: RevenueRankingGroup }) {
  const styles = groupStyles[group.key];

  return group.rows.map((row, rowIndex) => (
    <TableRow
      key={row.key}
      className={cn(
        "h-12 border-slate-300 hover:bg-transparent",
        rowIndex === 0 && `border-t-[3px] ${styles.accent}`
      )}
      data-ranking-group={group.key}
    >
      {rowIndex === 0 ? (
        <TableCell
          rowSpan={group.rows.length}
          className={cn(
            "sticky left-0 z-10 w-[250px] min-w-[250px] border-r-2 border-slate-400 px-5 text-center align-middle",
            styles.group
          )}
        >
          <p className="text-lg font-extrabold tracking-tight">{group.label}</p>
          <p className="mt-1 font-mono text-sm font-bold text-slate-600">({group.tier})</p>
          <p className="mt-2 text-xs font-medium text-slate-500">{group.rows.length} พื้นที่</p>
        </TableCell>
      ) : null}
      <TableCell
        className={cn(
          "sticky left-[250px] z-[9] w-56 min-w-56 border-r border-slate-300 px-4 font-bold text-slate-900",
          styles.area
        )}
      >
        <span>{row.label}</span>
        <span className="ml-2 text-xs font-normal text-slate-500">{row.unitName}</span>
      </TableCell>
      <TableCell className="bg-white px-4 text-right font-mono font-bold text-slate-950 tabular-nums">
        {formatMillionBaht(row.currentYtdRevenueBaht)}
      </TableCell>
      <TableCell className="bg-slate-50 px-4 text-right font-mono text-slate-700 tabular-nums">
        {formatMillionBaht(row.previousComparisonRevenueBaht)}
      </TableCell>
      <TableCell className="bg-amber-50/65 px-4 text-right">
        <Difference row={row} />
      </TableCell>
      <TableCell className="bg-slate-50 px-4 text-right font-mono font-semibold tabular-nums">
        {formatPercent(row.differencePercent)}
      </TableCell>
      <TableCell className="bg-white px-4 text-center">
        <RankBadge rank={row.rank} />
      </TableCell>
    </TableRow>
  ));
}

function RevenueRankingTable({ report }: { report: RevenueRankingReportData }) {
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

  const title = `จัดอันดับรายได้ปี ${formatBuddhistYear(report.reportYear).replace("พ.ศ. ", "")}`;

  const content = (
    <div
      className={cn(
        isFullscreen &&
          "fixed inset-0 z-[100] flex items-center justify-center bg-slate-100/95 p-2 backdrop-blur-sm"
      )}
      role={isFullscreen ? "dialog" : undefined}
      aria-modal={isFullscreen ? true : undefined}
      aria-label={isFullscreen ? "ตารางรายงาน Ranking แบบเต็มหน้าจอ" : undefined}
    >
      <Card
        className={cn(
          "w-full gap-0 overflow-hidden border-2 border-slate-600 py-0 shadow-sm",
          isFullscreen && "aspect-video max-w-[calc(177.78svh-1.7778rem)] rounded-lg shadow-2xl"
        )}
      >
        <CardHeader
          className={cn(
            "relative shrink-0 border-b-2 border-slate-600 bg-gradient-to-r from-amber-200 via-amber-100 to-slate-100 px-5 py-3",
            isFullscreen && "py-2"
          )}
        >
          <CardTitle className="text-center text-xl font-extrabold tracking-tight text-slate-950">
            {title}
          </CardTitle>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-slate-500 bg-white text-slate-900 shadow-sm hover:bg-amber-50"
              onClick={() => setIsFullscreen((current) => !current)}
              aria-pressed={isFullscreen}
              aria-label={isFullscreen ? "ออกจากโหมดเต็มหน้าจอ" : "แสดงตารางเต็มหน้าจอ 16 ต่อ 9"}
              title={isFullscreen ? "ออกจากโหมดเต็มหน้าจอ (Esc)" : "แสดงตารางเต็มหน้าจอ 16:9"}
              data-testid="revenue-ranking-fullscreen-toggle"
            >
              {isFullscreen ? <Minimize2Icon /> : <Maximize2Icon />}
              {isFullscreen ? "ออกจากเต็มจอ" : "เต็มหน้าจอ 16:9"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent
          className={cn(
            "min-h-0 flex-1 px-0",
            isFullscreen &&
              "[&>[data-slot=table-container]]:h-full [&>[data-slot=table-container]]:overflow-auto"
          )}
        >
          <Table
            className={cn(
              "min-w-[1220px] border-collapse",
              isFullscreen && "text-[13px] leading-tight [&_tbody_tr]:h-10 [&_td]:py-1"
            )}
          >
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-30">
              <TableRow className="border-b-2 border-slate-700 hover:bg-transparent">
                <TableHead className="left-0 z-40 w-[250px] min-w-[250px] bg-slate-800 px-5 text-center font-bold text-white">
                  ชื่อกลุ่ม
                </TableHead>
                <TableHead className="left-[250px] z-40 w-56 min-w-56 bg-slate-700 px-4 font-bold text-white">
                  พื้นที่
                </TableHead>
                <TableHead className="bg-amber-400 px-4 text-right font-bold text-slate-950">
                  รายได้สะสมปัจจุบัน
                  <span className="block text-[10px] font-medium">ล้านบาท</span>
                </TableHead>
                <TableHead className="bg-slate-300 px-4 text-right font-bold text-slate-950">
                  ช่วงเดียวกันปีก่อน
                  <span className="block text-[10px] font-medium">ล้านบาท</span>
                </TableHead>
                <TableHead className="bg-amber-200 px-4 text-right font-bold text-slate-950">
                  ส่วนต่าง
                  <span className="block text-[10px] font-medium">ล้านบาท</span>
                </TableHead>
                <TableHead className="bg-slate-300 px-4 text-right font-bold text-slate-950">
                  เปลี่ยนแปลง
                  <span className="block text-[10px] font-medium">%</span>
                </TableHead>
                <TableHead className="bg-amber-400 px-4 text-center font-bold text-slate-950">
                  อันดับในกลุ่ม
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.groups.map((group) => (
                <RankingRows key={group.key} group={group} />
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="h-12 border-t-[3px] border-slate-800 bg-amber-400 hover:bg-amber-400">
                <TableCell
                  colSpan={2}
                  className="sticky left-0 z-20 bg-amber-400 px-5 text-center text-base font-extrabold text-slate-950"
                >
                  รวม อป.
                </TableCell>
                <TableCell className="px-4 text-right font-mono text-base font-extrabold text-slate-950 tabular-nums">
                  {formatMillionBaht(report.totals.currentYtdRevenueBaht)}
                </TableCell>
                <TableCell className="bg-amber-300 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                  {formatMillionBaht(report.totals.previousComparisonRevenueBaht)}
                </TableCell>
                <TableCell className="bg-amber-200 px-4 text-right">
                  <Difference row={report.totals} />
                </TableCell>
                <TableCell className="bg-amber-300 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                  {formatPercent(report.totals.differencePercent)}
                </TableCell>
                <TableCell className="bg-amber-400" />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  return isFullscreen ? createPortal(content, document.body) : content;
}

function RankingSkeleton() {
  return <Skeleton className="h-[680px] w-full rounded-xl" />;
}

export function RevenueRankingReport({
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
    queryKey: ["revenue-ranking", year],
    queryFn: ({ signal }) => fetchRevenueRanking(year, signal),
  });

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">รายงาน Ranking</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            จัดอันดับรายได้สะสมของ 11 พื้นที่ภายในกลุ่มเดียวกัน
            พร้อมเปรียบเทียบช่วงเวลาเดียวกันกับปีก่อน
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">ขอบเขตองค์กร</span>
            <Badge className="h-8 border-amber-500 bg-amber-100 px-3 text-slate-900 hover:bg-amber-100">
              <MapPinnedIcon className="mr-1 size-3.5" /> เฉพาะพื้นที่ อป. — ภาคตะวันออก
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
          <RevenueRankingExportButton report={report.data ?? null} />
        </div>
      </div>

      {report.isError ? (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>โหลดรายงานไม่สำเร็จ</AlertTitle>
          <AlertDescription>{report.error.message}</AlertDescription>
        </Alert>
      ) : null}

      {report.data && !report.data.hasComparablePreviousYear ? (
        <Alert>
          <CalendarRangeIcon />
          <AlertTitle>ข้อมูลปีก่อนไม่ครบช่วงสำหรับเปรียบเทียบ</AlertTitle>
          <AlertDescription>
            ระบบจะแสดงรายได้ปีปัจจุบันและอันดับตามปกติ แต่ไม่แสดงส่วนต่างหรือเปอร์เซ็นต์ปีก่อน
          </AlertDescription>
        </Alert>
      ) : null}

      {report.isPending ? <RankingSkeleton /> : null}
      {report.data ? <RevenueRankingTable report={report.data} /> : null}
    </div>
  );
}
