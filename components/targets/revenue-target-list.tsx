"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon, PencilIcon, TargetIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteRevenueTarget, type RevenueTarget } from "@/lib/query/revenue-targets";
import { formatMoney, formatPercent } from "@/lib/revenue/formatters";
import { formatThaiMonthName } from "@/lib/revenue/reporting-period";
import { getRevenueTargetErrorMessage } from "@/lib/targets/revenue-targets";

function achievementVariant(value: string | null): "outline" | "warning" | "success" {
  if (value === null) return "outline";
  return Number(value) >= 100 ? "success" : "warning";
}

export function RevenueTargetList({
  year,
  throughMonth,
  targets,
  onEdit,
}: {
  year: number;
  throughMonth: number | null;
  targets: RevenueTarget[];
  onEdit: (target: RevenueTarget) => void;
}) {
  const queryClient = useQueryClient();
  const deletion = useMutation({
    mutationFn: deleteRevenueTarget,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["revenue-targets", year] });
      toast.success("ยกเลิกเป้าหมายแล้ว");
    },
    onError: (error) =>
      toast.error("ยกเลิกเป้าหมายไม่สำเร็จ", {
        description: getRevenueTargetErrorMessage(error.message),
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>เป้าหมายที่กำหนดไว้</CardTitle>
        <CardDescription>
          {targets.length.toLocaleString("th-TH")} รายการ · แสดงเฉพาะขอบเขตที่ตั้งเป้าหมายแล้ว
        </CardDescription>
      </CardHeader>
      <CardContent className={targets.length ? "px-0" : undefined}>
        {targets.length === 0 ? (
          <Empty className="min-h-72 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <TargetIcon />
              </EmptyMedia>
              <EmptyTitle>ยังไม่ได้ตั้งเป้าหมายสำหรับปีนี้</EmptyTitle>
              <EmptyDescription>
                รายการที่ไม่มีเป้าหมายจะไม่ถูกนับเป็นศูนย์ เพิ่มเฉพาะหน่วยงานหรือบริการที่ต้องการได้
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ขอบเขตเป้าหมาย</TableHead>
                <TableHead className="text-right">เป้าหมายทั้งปี</TableHead>
                <TableHead className="text-right">รายได้สะสมจริง</TableHead>
                <TableHead>เทียบเป้าหมาย</TableHead>
                <TableHead className="w-20 text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map((target) => {
                const progress = Math.min(100, Math.max(0, Number(target.achievementPercent ?? 0)));
                return (
                  <TableRow key={target.id}>
                    <TableCell className="min-w-64 whitespace-normal">
                      <p className="font-medium leading-snug">{target.organizationLabel}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{target.serviceLabel}</p>
                      {!target.dimensionAvailable ? (
                        <Badge variant="warning" className="mt-2">
                          <AlertTriangleIcon data-icon="inline-start" />
                          ไม่อยู่ในข้อมูลอ้างอิงล่าสุด
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums">
                      {formatMoney(target.targetAmountMillion)}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        ล้านบาท
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {target.actualRevenueBaht === null ? (
                        <span className="font-sans text-xs text-muted-foreground">
                          ยังไม่มีข้อมูลจริง
                        </span>
                      ) : (
                        <>
                          {formatMoney(target.actualRevenueBaht)}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            บาท
                          </span>
                        </>
                      )}
                    </TableCell>
                    <TableCell className="min-w-44 whitespace-normal">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={achievementVariant(target.achievementPercent)}>
                          {target.achievementPercent === null
                            ? "รอข้อมูลจริง"
                            : formatPercent(target.achievementPercent)}
                        </Badge>
                        {throughMonth && target.achievementPercent !== null ? (
                          <span className="text-xs text-muted-foreground">
                            ถึง {formatThaiMonthName(year, throughMonth)}
                          </span>
                        ) : null}
                      </div>
                      {target.achievementPercent !== null ? (
                        <div
                          className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                          aria-hidden="true"
                        >
                          <div
                            className="h-full rounded-full bg-primary transition-[width]"
                            style={{ width: progress + "%" }}
                          />
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={
                            "แก้ไข " + target.organizationLabel + " " + target.serviceLabel
                          }
                          onClick={() => onEdit(target)}
                        >
                          <PencilIcon />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={deletion.isPending}
                                aria-label={
                                  "ยกเลิก " + target.organizationLabel + " " + target.serviceLabel
                                }
                              />
                            }
                          >
                            {deletion.isPending && deletion.variables === target.id ? (
                              <Spinner />
                            ) : (
                              <Trash2Icon />
                            )}
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>ยกเลิกเป้าหมายนี้?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {target.organizationLabel} · {target.serviceLabel} เป้าหมาย{" "}
                                {formatMoney(target.targetAmountMillion)} ล้านบาท หลังยกเลิก
                                ระบบจะแสดงขอบเขตนี้ว่า “ยังไม่ได้ตั้งเป้าหมาย” ไม่ใช่ศูนย์
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>กลับ</AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                onClick={() => deletion.mutate(target.id)}
                              >
                                ยกเลิกเป้าหมาย
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
