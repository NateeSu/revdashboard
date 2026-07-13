import { notFound } from "next/navigation";

import { ImportActions } from "@/components/imports/import-actions";
import { ImportStatusBadge } from "@/components/imports/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ImportStatus, Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatThaiDateTime } from "@/lib/revenue/formatters";

function jsonArray(value: Json): Array<Record<string, Json | undefined>> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, Json | undefined> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item)
      )
    : [];
}

export default async function ImportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: batch, error }, { data: active }] = await Promise.all([
    supabase.from("import_batches").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("active_datasets")
      .select("active_batch_id")
      .eq("active_batch_id", id)
      .maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  if (!batch) notFound();
  const monthlyTotals = jsonArray(batch.monthly_totals);
  const summary =
    typeof batch.validation_summary === "object" &&
    batch.validation_summary &&
    !Array.isArray(batch.validation_summary)
      ? batch.validation_summary
      : {};
  const issues = jsonArray(summary.issues ?? []);

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">รายละเอียด Import</h1>
          <p className="mt-1 text-sm text-muted-foreground">{batch.original_filename}</p>
        </div>
        <div className="flex gap-2">
          <ImportStatusBadge status={batch.status as ImportStatus} />
          {active ? <Badge variant="success">Active Dataset</Badge> : null}
        </div>
      </div>
      <ImportActions
        batchId={batch.id}
        status={batch.status as ImportStatus}
        storagePath={batch.storage_path}
        reportYear={batch.report_year}
        reportEndMonth={batch.report_end_month}
        ytdRevenue={formatMoney(batch.ytd_revenue)}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลไฟล์</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Upload</dt>
              <dd>{formatThaiDateTime(batch.created_at)}</dd>
              <dt className="text-muted-foreground">SHA-256</dt>
              <dd className="break-all font-mono text-xs">{batch.file_hash}</dd>
              <dt className="text-muted-foreground">ชีท / Header</dt>
              <dd>
                {batch.source_sheet_name} / แถว {batch.header_row}
              </dd>
              <dt className="text-muted-foreground">ปี / งวดล่าสุด</dt>
              <dd>
                {batch.report_year + 543} / {batch.report_end_month}
              </dd>
              <dt className="text-muted-foreground">Detail / Revenue</dt>
              <dd>
                {batch.detail_row_count.toLocaleString("th-TH")} /{" "}
                {batch.generated_revenue_row_count.toLocaleString("th-TH")}
              </dd>
              <dt className="text-muted-foreground">ไฟล์จัดเก็บ</dt>
              <dd className="break-all text-xs">{batch.storage_path ?? "—"}</dd>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Validation Summary</CardTitle>
            <CardDescription>ยอดรายได้และจำนวนช่องพิเศษ</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">เดือนล่าสุด</dt>
                <dd className="font-mono font-semibold">
                  {formatMoney(batch.current_month_revenue)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">YTD</dt>
                <dd className="font-mono font-semibold">{formatMoney(batch.ytd_revenue)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Blank</dt>
                <dd>{batch.blank_revenue_cell_count.toLocaleString("th-TH")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Zero</dt>
                <dd>{batch.zero_revenue_cell_count.toLocaleString("th-TH")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Negative</dt>
                <dd className="text-destructive">
                  {batch.negative_revenue_cell_count.toLocaleString("th-TH")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">ยอดติดลบ</dt>
                <dd className="font-mono text-destructive">
                  {formatMoney(batch.negative_revenue_amount)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>ยอดรายเดือน</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>งวด</TableHead>
                <TableHead className="text-right">รายได้</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyTotals.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{String(item.period ?? "")}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatMoney(String(item.revenue ?? "0"))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Validation Issues</CardTitle>
          <CardDescription>{issues.length.toLocaleString("th-TH")} รายการ</CardDescription>
        </CardHeader>
        <CardContent>
          {issues.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>รายละเอียด</TableHead>
                  <TableHead>แถว</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue, index) => (
                  <TableRow key={index}>
                    <TableCell>{String(issue.severity ?? "")}</TableCell>
                    <TableCell className="font-mono text-xs">{String(issue.code ?? "")}</TableCell>
                    <TableCell className="whitespace-normal">
                      {String(issue.message ?? "")}
                    </TableCell>
                    <TableCell>{String(issue.sourceRow ?? "—")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">ไม่พบ Validation Issue</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
