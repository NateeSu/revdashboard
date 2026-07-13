"use client";

import { DownloadIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ImportStatus } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";

export function ImportActions({
  batchId,
  status,
  storagePath,
  reportYear,
  reportEndMonth,
  ytdRevenue,
}: {
  batchId: string;
  status: ImportStatus;
  storagePath: string | null;
  reportYear: number;
  reportEndMonth: string;
  ytdRevenue: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"download" | "publish" | "delete" | null>(null);

  async function download() {
    if (!storagePath) return;
    setBusy("download");
    const { data, error } = await createClient()
      .storage.from("source-files")
      .createSignedUrl(storagePath, 60, { download: true });
    setBusy(null);
    if (error || !data) return toast.error("สร้างลิงก์ดาวน์โหลดไม่สำเร็จ");
    const anchor = document.createElement("a");
    anchor.href = data.signedUrl;
    anchor.click();
  }

  async function publish() {
    setBusy("publish");
    const { error } = await createClient().rpc("publish_import_batch", { p_batch_id: batchId });
    setBusy(null);
    if (error) return toast.error("สลับเวอร์ชันไม่สำเร็จ", { description: error.message });
    toast.success("สลับ Active Dataset แล้ว");
    router.refresh();
  }

  async function remove() {
    setBusy("delete");
    const supabase = createClient();
    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from("source-files")
        .remove([storagePath]);
      if (storageError) {
        setBusy(null);
        return toast.error("ลบไฟล์ต้นฉบับไม่สำเร็จ จึงยังไม่ลบ Import");
      }
    }
    const { error } = await supabase.rpc("delete_unpublished_import", { p_batch_id: batchId });
    setBusy(null);
    if (error) return toast.error("ลบ Import ไม่สำเร็จ", { description: error.message });
    toast.success("ลบ Import ที่ยังไม่เผยแพร่แล้ว");
    router.push("/imports");
    router.refresh();
  }

  const canPublish = status === "validated" || status === "superseded" || status === "published";
  const canDelete = status === "uploading" || status === "validated" || status === "failed";

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={!storagePath || busy !== null} onClick={download}>
        {busy === "download" ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <DownloadIcon data-icon="inline-start" />
        )}
        ดาวน์โหลดไฟล์ต้นฉบับ
      </Button>
      {canPublish ? (
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="outline" disabled={busy !== null} />}>
            <RotateCcwIcon data-icon="inline-start" />
            ใช้ข้อมูลเวอร์ชันนี้
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ยืนยันการสลับ Active Dataset</AlertDialogTitle>
              <AlertDialogDescription>
                ปี {reportYear + 543} · งวด {reportEndMonth} · YTD {ytdRevenue} บาท
                เวอร์ชันปัจจุบันของปีเดียวกันจะเปลี่ยนเป็น “เวอร์ชันก่อนหน้า”
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction onClick={publish}>ยืนยันการใช้งาน</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
      {canDelete ? (
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive" disabled={busy !== null} />}>
            <Trash2Icon data-icon="inline-start" />
            ลบ Import
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ลบ Import ที่ยังไม่เผยแพร่?</AlertDialogTitle>
              <AlertDialogDescription>
                ระบบจะลบแถวรายได้และไฟล์ต้นฉบับ การดำเนินการนี้ย้อนกลับไม่ได้
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={remove}>
                ลบข้อมูล
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
