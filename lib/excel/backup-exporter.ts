import { createClient } from "@/lib/supabase/client";

export async function exportFullBackup(onProgress: (message: string, rows?: number) => void) {
  const supabase = createClient();
  const [
    { data: batches, error: batchError },
    { data: active, error: activeError },
    { data: userData },
  ] = await Promise.all([
    supabase.from("import_batches").select("*").order("created_at"),
    supabase.from("active_datasets").select("*").order("report_year"),
    supabase.auth.getUser(),
  ]);
  if (batchError) throw new Error(batchError.message);
  if (activeError) throw new Error(activeError.message);

  const revenueRows: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("revenue_import_rows")
      .select("*")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    page.forEach((row) => revenueRows.push(JSON.stringify(row)));
    onProgress("กำลังดึงแถวรายได้", revenueRows.length);
    if (page.length < 1000) break;
  }

  onProgress("กำลังสร้างไฟล์ ZIP", revenueRows.length);
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file("import_batches.json", JSON.stringify(batches ?? [], null, 2));
  zip.file("active_datasets.json", JSON.stringify(active ?? [], null, 2));
  zip.file("revenue_import_rows.jsonl", `${revenueRows.join("\n")}\n`);
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        formatVersion: 1,
        application: "Revenue Dashboard",
        exportedAt: new Date().toISOString(),
        exportedBy: userData.user?.email ?? null,
        timezone: "Asia/Bangkok",
        counts: {
          importBatches: batches?.length ?? 0,
          activeDatasets: active?.length ?? 0,
          revenueRows: revenueRows.length,
        },
        restoreStrategy:
          "นำ source .xlsx แต่ละเวอร์ชันกลับเข้าระบบใหม่ หรือใช้ JSON/JSONL สำหรับ database maintenance ที่ผ่านการตรวจสอบ",
      },
      null,
      2
    )
  );
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `revenue-dashboard-backup_${timestamp}.zip`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return filename;
}
