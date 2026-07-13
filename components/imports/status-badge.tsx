import { Badge } from "@/components/ui/badge";
import type { ImportStatus } from "@/lib/supabase/database.types";

const statusLabels: Record<ImportStatus, string> = {
  uploading: "กำลังบันทึก",
  validated: "พร้อมเผยแพร่",
  published: "ใช้งานอยู่",
  superseded: "เวอร์ชันก่อนหน้า",
  failed: "ไม่สำเร็จ",
};

export function ImportStatusBadge({ status }: { status: ImportStatus }) {
  const variant =
    status === "published"
      ? "success"
      : status === "failed"
        ? "destructive"
        : status === "validated"
          ? "warning"
          : "secondary";
  return <Badge variant={variant}>{statusLabels[status]}</Badge>;
}
