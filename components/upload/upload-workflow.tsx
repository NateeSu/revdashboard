"use client";

import { useMemo, useState } from "react";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  FileCheck2Icon,
  FileSpreadsheetIcon,
  HashIcon,
  SaveIcon,
  SendIcon,
  SheetIcon,
  TablePropertiesIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { UploadDropzone, validateSelectedFile } from "@/components/upload/upload-dropzone";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseRevenueWorkbook } from "@/lib/excel/parser";
import { ExcelParseError, type ParseResult, type ValidationSeverity } from "@/lib/excel/types";
import { DuplicateImportError, persistImport, publishImport } from "@/lib/imports/persistence";
import { formatMoney } from "@/lib/revenue/formatters";
import { cn } from "@/lib/utils";

const steps = ["เลือกไฟล์", "วิเคราะห์ไฟล์", "ตรวจสอบผล", "บันทึกข้อมูล", "เผยแพร่"] as const;
const maxUploadMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 10);

function Stepper({ activeStep }: { activeStep: number }) {
  return (
    <ol className="grid grid-cols-5" aria-label="ขั้นตอนนำเข้าไฟล์">
      {steps.map((step, index) => {
        const position = index + 1;
        const complete = position < activeStep;
        const active = position === activeStep;
        return (
          <li key={step} className="relative flex flex-col items-center gap-2 text-center">
            {index > 0 ? (
              <span
                className={cn(
                  "absolute top-4 right-1/2 h-px w-full",
                  complete || active ? "bg-primary" : "bg-border"
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative grid size-8 place-items-center rounded-full border text-xs font-semibold",
                complete || active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-muted-foreground"
              )}
              aria-current={active ? "step" : undefined}
            >
              {complete ? <CheckCircle2Icon /> : position}
            </span>
            <span
              className={cn(
                "hidden text-xs sm:block",
                active ? "font-semibold text-foreground" : "text-muted-foreground"
              )}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function severityBadge(severity: ValidationSeverity) {
  if (severity === "error") return <Badge variant="destructive">ข้อผิดพลาด</Badge>;
  if (severity === "warning") return <Badge variant="warning">คำเตือน</Badge>;
  return <Badge variant="outline">ข้อมูล</Badge>;
}

function SummaryMetric({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-mono text-sm font-semibold tabular-nums",
          danger ? "text-destructive" : "text-foreground"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function ValidationReview({ file, result }: { file: File; result: ParseResult }) {
  const summary = result.summary;
  const issuesBySeverity = useMemo(
    () => ({
      error: summary.issues.filter((issue) => issue.severity === "error"),
      warning: summary.issues.filter((issue) => issue.severity === "warning"),
      info: summary.issues.filter((issue) => issue.severity === "info"),
    }),
    [summary.issues]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 xl:grid-cols-5">
        {[
          { icon: FileSpreadsheetIcon, label: "ไฟล์", value: file.name },
          { icon: FileCheck2Icon, label: "ขนาดไฟล์", value: `${(file.size / 1024).toFixed(2)} KB` },
          { icon: SheetIcon, label: "ชีท", value: summary.sheetName },
          { icon: TablePropertiesIcon, label: "แถวหัวตาราง", value: String(summary.headerRow) },
          { icon: HashIcon, label: "SHA-256", value: `${result.fileHash.slice(0, 16)}…` },
        ].map((item) => (
          <div key={item.label} className="flex min-w-0 items-center gap-3 bg-background p-3">
            <item.icon className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="truncate text-sm font-medium" title={item.value}>
                {item.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>สรุปผลการตรวจสอบ</CardTitle>
            <CardDescription>ยอดทั้งหมดคำนวณจากแถวรายละเอียดเท่านั้น</CardDescription>
          </CardHeader>
          <CardContent>
            <dl>
              <SummaryMetric
                label="จำนวนแถวรายละเอียด"
                value={summary.detailRowCount.toLocaleString("th-TH")}
              />
              <SummaryMetric
                label="จำนวนแถวรายได้ที่สร้าง"
                value={summary.generatedRevenueRowCount.toLocaleString("th-TH")}
              />
              <SummaryMetric
                label="ช่องข้อมูลว่าง"
                value={summary.blankRevenueCellCount.toLocaleString("th-TH")}
              />
              <SummaryMetric
                label="ค่าศูนย์"
                value={summary.zeroRevenueCellCount.toLocaleString("th-TH")}
              />
              <SummaryMetric
                label="ค่าติดลบ"
                value={summary.negativeRevenueCellCount.toLocaleString("th-TH")}
                danger
              />
              <SummaryMetric
                label="รายได้เดือนล่าสุด"
                value={`${formatMoney(summary.currentMonthRevenue)} บาท`}
              />
              <SummaryMetric label="รายได้สะสม" value={`${formatMoney(summary.ytdRevenue)} บาท`} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>ระดับความรุนแรงของปัญหา</CardTitle>
              <Badge variant={summary.valid ? "success" : "destructive"}>
                {summary.valid ? "พร้อมบันทึก" : "ต้องแก้ไขไฟล์"}
              </Badge>
            </div>
            <CardDescription>ข้อผิดพลาดจะปิดการบันทึก ส่วนคำเตือนยังเผยแพร่ได้</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(["error", "warning", "info"] as const).map((severity) => (
              <section key={severity} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  {severityBadge(severity)}
                  <span className="font-mono text-xs tabular-nums">
                    {issuesBySeverity[severity].length} รายการ
                  </span>
                </div>
                {issuesBySeverity[severity].length ? (
                  <ul className="flex flex-col gap-1 text-sm">
                    {issuesBySeverity[severity].slice(0, 8).map((issue, index) => (
                      <li key={`${issue.code}-${index}`} className="flex gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>
                          {issue.message}
                          {issue.sourceRow ? ` (แถว ${issue.sourceRow})` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">ไม่พบรายการ</p>
                )}
              </section>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>สรุปรายได้รายเดือน</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>งวด</TableHead>
                  <TableHead className="text-right">รายได้ (บาท)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.monthlyTotals.map((item) => (
                  <TableRow key={item.period}>
                    <TableCell>{item.period}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMoney(item.revenue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>แถวที่ไม่นำเข้าประมวลผล</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ประเภท</TableHead>
                  <TableHead className="text-right">จำนวนแถว</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["Service Group Total", result.excludedRows.serviceGroupTotal],
                  ["Business Group Total", result.excludedRows.businessGroupTotal],
                  ["Section Total", result.excludedRows.sectionTotal],
                  ["Unit Total", result.excludedRows.unitTotal],
                  ["Grand Total", result.excludedRows.grandTotal],
                  ["หมายเหตุ/แถวว่าง", result.excludedRows.noteOrBlank],
                ].map(([label, value]) => (
                  <TableRow key={String(label)}>
                    <TableCell>{label}</TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(value).toLocaleString("th-TH")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ตัวอย่างข้อมูล</CardTitle>
          <CardDescription>แสดง 5 แถวแรกจาก Preview สูงสุด 100 แถว</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>แถว</TableHead>
                <TableHead>หน่วยงาน</TableHead>
                <TableHead>ส่วนงาน</TableHead>
                <TableHead>กลุ่มบริการ</TableHead>
                <TableHead>รายบริการ</TableHead>
                <TableHead className="text-right">สะสม (บาท)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.details.slice(0, 5).map((row) => (
                <TableRow key={row.recordKey}>
                  <TableCell>{row.sourceRowNumber}</TableCell>
                  <TableCell>{row.unitName}</TableCell>
                  <TableCell className="max-w-64 whitespace-normal">{row.sectionName}</TableCell>
                  <TableCell className="max-w-64 whitespace-normal">{row.serviceGroup}</TableCell>
                  <TableCell className="max-w-64 whitespace-normal">{row.serviceName}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono",
                      Number(row.calculatedYtd) < 0 && "text-destructive"
                    )}
                  >
                    {formatMoney(row.calculatedYtd)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function UploadWorkflow() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });

  async function analyze(selectedFile: File) {
    setError(null);
    const selectionError = validateSelectedFile(selectedFile, maxUploadMb);
    if (selectionError) {
      setError(selectionError);
      return;
    }
    setBusy(true);
    setFile(selectedFile);
    setResult(null);
    setBatchId(null);
    setActiveStep(2);
    try {
      await new Promise(requestAnimationFrame);
      const parsed = await parseRevenueWorkbook(await selectedFile.arrayBuffer(), {
        filename: selectedFile.name,
      });
      setResult(parsed);
      setActiveStep(3);
      toast.success("วิเคราะห์ไฟล์เรียบร้อยแล้ว");
    } catch (parseError) {
      const message =
        parseError instanceof ExcelParseError
          ? parseError.issues[0]?.message
          : "ไม่สามารถวิเคราะห์ไฟล์ได้";
      setError(message);
      setActiveStep(1);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!file || !result || !result.summary.valid) return;
    setBusy(true);
    setError(null);
    setActiveStep(4);
    setProgress({ processed: 0, total: result.revenueRows.length });
    try {
      const id = await persistImport(file, result, (processed, total) =>
        setProgress({ processed, total })
      );
      setBatchId(id);
      toast.success("บันทึกข้อมูลครบถ้วนและพร้อมเผยแพร่");
    } catch (saveError) {
      if (saveError instanceof DuplicateImportError) {
        setBatchId(saveError.batchId);
        setError("ไฟล์นี้เคยถูกนำเข้าแล้ว เปิด Import เดิมเพื่อตรวจสอบหรือเผยแพร่");
      } else {
        setError(saveError instanceof Error ? saveError.message : "บันทึกข้อมูลไม่สำเร็จ");
      }
      setActiveStep(3);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!batchId) return;
    setBusy(true);
    setError(null);
    try {
      await publishImport(batchId);
      setActiveStep(5);
      toast.success("เผยแพร่ชุดข้อมูลแล้ว Dashboard จะใช้เวอร์ชันนี้");
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "เผยแพร่ข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setBatchId(null);
    setError(null);
    setActiveStep(1);
    setProgress({ processed: 0, total: 0 });
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">นำเข้าไฟล์รายได้</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ตรวจสอบข้อมูลใน Browser ก่อนบันทึกเป็นเวอร์ชันใหม่
        </p>
      </div>
      <Stepper activeStep={activeStep} />
      <Separator />

      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>ดำเนินการไม่สำเร็จ</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          {batchId ? (
            <Button
              render={<Link href={`/imports/${batchId}`} />}
              nativeButton={false}
              variant="outline"
              className="mt-3 w-fit"
            >
              เปิด Import เดิม
            </Button>
          ) : null}
        </Alert>
      ) : null}

      {!result ? (
        <UploadDropzone onFile={analyze} disabled={busy} />
      ) : (
        <ValidationReview file={file as File} result={result} />
      )}

      {busy && activeStep === 2 ? (
        <Alert>
          <FileSpreadsheetIcon />
          <AlertTitle>กำลังวิเคราะห์ไฟล์</AlertTitle>
          <AlertDescription>
            ระบบกำลังอ่าน Header, เดือน, แถวรายละเอียด และตรวจยอดควบคุม
          </AlertDescription>
        </Alert>
      ) : null}

      {result ? (
        <div className="sticky bottom-0 flex flex-col gap-3 border-t bg-background/95 py-4 backdrop-blur sm:flex-row sm:items-center">
          <Button variant="outline" onClick={reset} disabled={busy}>
            <ArrowLeftIcon data-icon="inline-start" />
            เปลี่ยนไฟล์
          </Button>
          {activeStep === 4 && !batchId ? (
            <Progress
              className="min-w-0 flex-1"
              value={progress.total ? (progress.processed / progress.total) * 100 : 0}
            >
              <ProgressLabel>ความคืบหน้าการบันทึก</ProgressLabel>
              <ProgressValue>
                {() =>
                  `${progress.processed.toLocaleString("th-TH")} / ${progress.total.toLocaleString("th-TH")}`
                }
              </ProgressValue>
            </Progress>
          ) : (
            <span className="flex-1" />
          )}
          {!batchId ? (
            <Button onClick={save} disabled={busy || !result.summary.valid}>
              <SaveIcon data-icon="inline-start" />
              {busy ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </Button>
          ) : activeStep < 5 ? (
            <Button onClick={publish} disabled={busy}>
              <SendIcon data-icon="inline-start" />
              {busy ? "กำลังเผยแพร่..." : "เผยแพร่ข้อมูล"}
            </Button>
          ) : (
            <Button render={<Link href="/dashboard" />} nativeButton={false}>
              <CheckCircle2Icon data-icon="inline-start" />
              เปิด Dashboard
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
