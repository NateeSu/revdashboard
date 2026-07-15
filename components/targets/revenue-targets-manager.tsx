"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon, CalendarRangeIcon, InfoIcon, TargetIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { RevenueTargetForm } from "@/components/targets/revenue-target-form";
import { RevenueTargetList } from "@/components/targets/revenue-target-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchRevenueTargetSetup, type RevenueTarget } from "@/lib/query/revenue-targets";
import { formatBuddhistYear } from "@/lib/revenue/reporting-period";

export function RevenueTargetsManager({ initialYear }: { initialYear: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedYear = Number(searchParams.get("year"));
  const year =
    Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2200
      ? requestedYear
      : initialYear;
  const [editingTarget, setEditingTarget] = useState<RevenueTarget | null>(null);

  const setupQuery = useQuery({
    queryKey: ["revenue-targets", year],
    queryFn: ({ signal }) => fetchRevenueTargetSetup(year, signal),
  });

  const yearOptions = setupQuery.data?.yearOptions ?? [year];

  function changeYear(nextYear: number) {
    setEditingTarget(null);
    router.replace(pathname + "?year=" + nextYear, { scroll: false });
  }

  function edit(target: RevenueTarget) {
    setEditingTarget(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TargetIcon className="size-6 text-primary" />
            <h1 className="font-heading text-2xl font-semibold tracking-tight">เป้าหมายรายได้</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            กำหนดเป้าหมายรายปีให้เฉพาะกลุ่ม ฝ่าย หรือส่วนงาน และขอบเขตบริการที่ต้องการ
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          ปีเป้าหมาย
          <NativeSelect
            value={String(year)}
            onChange={(event) => changeYear(Number(event.target.value))}
          >
            {yearOptions.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {formatBuddhistYear(option)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      </div>

      <Alert>
        <InfoIcon />
        <AlertTitle>กำหนดเฉพาะรายการที่มีเป้าหมาย</AlertTitle>
        <AlertDescription>
          รายการที่ไม่ได้เพิ่มจะหมายถึง “ยังไม่ได้ตั้งเป้าหมาย” ไม่ใช่เป้าหมายศูนย์
          และระบบจะไม่รวมเป้าหมายต่างระดับเข้าด้วยกันโดยอัตโนมัติ
        </AlertDescription>
      </Alert>

      {setupQuery.isError ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>โหลดข้อมูลตั้งเป้าหมายไม่สำเร็จ</AlertTitle>
          <AlertDescription>{setupQuery.error.message}</AlertDescription>
        </Alert>
      ) : null}

      {setupQuery.isPending ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.5fr)]">
          <Skeleton className="h-[650px]" />
          <Skeleton className="h-[430px]" />
        </div>
      ) : null}

      {setupQuery.data ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={setupQuery.data.hasYearData ? "success" : "outline"}>
              <CalendarRangeIcon data-icon="inline-start" />
              {setupQuery.data.hasYearData
                ? "มีข้อมูลจริงสำหรับปีนี้"
                : "ยังไม่มีข้อมูลจริงสำหรับปีนี้"}
            </Badge>
            {setupQuery.data.optionsSourceYear !== null &&
            setupQuery.data.optionsSourceYear !== year ? (
              <span>
                ตัวเลือกหน่วยงานและบริการอ้างอิงจาก{" "}
                {formatBuddhistYear(setupQuery.data.optionsSourceYear)}
              </span>
            ) : null}
          </div>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.5fr)]">
            <RevenueTargetForm
              setup={setupQuery.data}
              editingTarget={editingTarget}
              onFinished={() => setEditingTarget(null)}
            />
            <RevenueTargetList
              year={year}
              throughMonth={setupQuery.data.throughMonth}
              targets={setupQuery.data.targets}
              onEdit={edit}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
