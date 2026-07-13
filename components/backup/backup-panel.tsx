"use client";

import { ArchiveIcon, DatabaseBackupIcon, FileJsonIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export function BackupPanel() {
  const [progress, setProgress] = useState<string | null>(null);

  async function exportBackup() {
    setProgress("กำลังเตรียมข้อมูล");
    try {
      const { exportFullBackup } = await import("@/lib/excel/backup-exporter");
      const filename = await exportFullBackup((message, rows) =>
        setProgress(rows ? `${message} · ${rows.toLocaleString("th-TH")} แถว` : message)
      );
      toast.success("สร้าง Full Backup สำเร็จ", { description: filename });
    } catch (error) {
      toast.error("สร้าง Backup ไม่สำเร็จ", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl font-semibold">สำรองข้อมูล</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ดาวน์โหลดข้อมูลทุกเวอร์ชันออกจาก Supabase เพื่อเก็บรักษาหรือย้ายระบบ
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Export Full Backup</CardTitle>
          <CardDescription>สร้าง ZIP ใน Browser โดยไม่ผ่าน Vercel Function</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex gap-3 rounded-lg border p-4">
              <ArchiveIcon className="size-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Metadata</p>
                <p className="text-xs text-muted-foreground">
                  import_batches.json, active_datasets.json, manifest.json
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-lg border p-4">
              <FileJsonIcon className="size-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Revenue rows</p>
                <p className="text-xs text-muted-foreground">
                  revenue_import_rows.jsonl ครบทุก Import version
                </p>
              </div>
            </div>
          </div>
          <Button className="w-fit" disabled={Boolean(progress)} onClick={exportBackup}>
            {progress ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <DatabaseBackupIcon data-icon="inline-start" />
            )}
            {progress ?? "Export Full Backup"}
          </Button>
        </CardContent>
      </Card>
      <Alert>
        <ArchiveIcon />
        <AlertTitle>การ Restore</AlertTitle>
        <AlertDescription>
          Restore อัตโนมัติไม่อยู่ใน MVP ไฟล์ source .xlsx
          ทุกเวอร์ชันสามารถนำเข้าใหม่เพื่อสร้างข้อมูลได้ README อธิบายขั้นตอนสำหรับ maintenance
          restore จาก JSON/JSONL
        </AlertDescription>
      </Alert>
    </div>
  );
}
