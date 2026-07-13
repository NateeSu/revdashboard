import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

import { ImportStatusBadge } from "@/components/imports/status-badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ImportStatus } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatThaiDateTime } from "@/lib/revenue/formatters";

export default async function ImportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const year = Number(Array.isArray(params.year) ? params.year[0] : params.year);
  const status = (Array.isArray(params.status) ? params.status[0] : params.status) as
    ImportStatus | undefined;
  const search = String(Array.isArray(params.search) ? params.search[0] : (params.search ?? ""));
  const supabase = await createClient();
  let query = supabase.from("import_batches").select("*").order("created_at", { ascending: false });
  if (Number.isInteger(year) && year > 0) query = query.eq("report_year", year);
  if (status && ["uploading", "validated", "published", "superseded", "failed"].includes(status))
    query = query.eq("status", status);
  if (search) query = query.ilike("original_filename", `%${search}%`);
  const [{ data: batches, error }, { data: active }] = await Promise.all([
    query,
    supabase.from("active_datasets").select("active_batch_id"),
  ]);
  if (error) throw new Error(error.message);
  const activeIds = new Set((active ?? []).map((item) => item.active_batch_id));

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl font-semibold">ประวัติการนำเข้า</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ทุก Import เป็น immutable version และสามารถย้อนกลับมาใช้งานได้
        </p>
      </div>
      <form className="flex flex-wrap gap-2 rounded-lg border p-3">
        <input
          name="search"
          defaultValue={search}
          className="h-8 min-w-64 rounded-lg border bg-transparent px-2.5 text-sm"
          placeholder="ค้นหาชื่อไฟล์"
        />
        <input
          name="year"
          defaultValue={year || ""}
          className="h-8 w-28 rounded-lg border bg-transparent px-2.5 text-sm"
          inputMode="numeric"
          placeholder="ปี ค.ศ."
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-8 rounded-lg border bg-transparent px-2.5 text-sm"
        >
          <option value="">ทุกสถานะ</option>
          <option value="uploading">กำลังบันทึก</option>
          <option value="validated">พร้อมเผยแพร่</option>
          <option value="published">ใช้งานอยู่</option>
          <option value="superseded">เวอร์ชันก่อนหน้า</option>
          <option value="failed">ไม่สำเร็จ</option>
        </select>
        <Button type="submit" variant="outline">
          กรองข้อมูล
        </Button>
      </form>
      {!batches?.length ? (
        <Empty className="min-h-96">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ExternalLinkIcon />
            </EmptyMedia>
            <EmptyTitle>ไม่พบประวัติการนำเข้า</EmptyTitle>
            <EmptyDescription>ลองล้างตัวกรองหรือนำเข้าไฟล์รายได้ชุดแรก</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Import Versions</CardTitle>
            <CardDescription>
              {batches.length.toLocaleString("th-TH")} รายการ เรียงล่าสุดก่อน
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่ Upload</TableHead>
                  <TableHead>ชื่อไฟล์</TableHead>
                  <TableHead>ปี/งวด</TableHead>
                  <TableHead className="text-right">Detail / Revenue</TableHead>
                  <TableHead className="text-right">รายได้เดือนล่าสุด</TableHead>
                  <TableHead className="text-right">รายได้สะสม</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>{formatThaiDateTime(batch.created_at)}</TableCell>
                    <TableCell className="max-w-64 truncate" title={batch.original_filename}>
                      {batch.original_filename}
                    </TableCell>
                    <TableCell>
                      {batch.report_year + 543} / {batch.report_end_month.slice(0, 7)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {batch.detail_row_count.toLocaleString("th-TH")} /{" "}
                      {batch.generated_revenue_row_count.toLocaleString("th-TH")}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMoney(batch.current_month_revenue)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMoney(batch.ytd_revenue)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <ImportStatusBadge status={batch.status as ImportStatus} />
                        {activeIds.has(batch.id) ? <Badge variant="success">Active</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        render={<Link href={`/imports/${batch.id}`} />}
                        nativeButton={false}
                        size="sm"
                        variant="ghost"
                      >
                        ดูรายละเอียด
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
