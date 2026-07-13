import type { Json } from "@/lib/supabase/database.types";
import type { ParseResult } from "@/lib/excel/types";
import { createClient } from "@/lib/supabase/client";

const MAX_RETRIES = 3;
const CHUNK_SIZE = 500;

export class DuplicateImportError extends Error {
  constructor(readonly batchId: string) {
    super("ไฟล์นี้เคยถูกนำเข้าแล้ว");
    this.name = "DuplicateImportError";
  }
}

function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export function sanitizeFilename(filename: string): string {
  const cleaned = filename
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\.{2,}/g, ".")
    .trim();
  return (cleaned || "source.xlsx").slice(0, 180);
}

async function retry<T>(operation: () => Promise<T>): Promise<T> {
  let latestError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      latestError = error;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
  }
  throw latestError;
}

export async function persistImport(
  file: File,
  result: ParseResult,
  onProgress: (processed: number, total: number) => void
): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("ไม่พบ session ผู้ใช้ กรุณาเข้าสู่ระบบใหม่");

  const { data: existing } = await supabase
    .from("import_batches")
    .select("id")
    .eq("file_hash", result.fileHash)
    .maybeSingle();
  if (existing) throw new DuplicateImportError(existing.id);

  const summary = result.summary;
  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      owner_id: user.id,
      original_filename: file.name,
      file_hash: result.fileHash,
      file_size_bytes: file.size,
      source_sheet_name: summary.sheetName,
      header_row: summary.headerRow,
      report_year: summary.reportYear,
      report_end_month: `${summary.reportEndMonth.slice(0, 4)}-${summary.reportEndMonth.slice(4, 6)}-01`,
      status: "uploading",
      source_row_count: summary.sourceRowCount,
      detail_row_count: summary.detailRowCount,
      generated_revenue_row_count: summary.generatedRevenueRowCount,
      excluded_row_count:
        summary.serviceGroupTotalCount +
        summary.businessGroupTotalCount +
        summary.sectionTotalCount +
        summary.unitTotalCount +
        summary.grandTotalCount +
        summary.ignoredNoteOrBlankCount,
      blank_revenue_cell_count: summary.blankRevenueCellCount,
      zero_revenue_cell_count: summary.zeroRevenueCellCount,
      negative_revenue_cell_count: summary.negativeRevenueCellCount,
      negative_revenue_amount: summary.negativeRevenueAmount,
      current_month_revenue: summary.currentMonthRevenue,
      ytd_revenue: summary.ytdRevenue,
      monthly_totals: asJson(result.monthlyTotals),
      validation_summary: asJson(summary),
      storage_path: null,
      failure_message: null,
    })
    .select("id")
    .single();
  if (batchError || !batch)
    throw new Error(batchError?.message ?? "ไม่สามารถสร้าง Import Batch ได้");

  const storagePath = `${user.id}/${summary.reportYear}/${batch.id}/${sanitizeFilename(file.name)}`;
  try {
    const { error: uploadError } = await supabase.storage
      .from("source-files")
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    await supabase.from("import_batches").update({ storage_path: storagePath }).eq("id", batch.id);
    const rows = result.revenueRows.map((row) => ({
      batch_id: batch.id,
      owner_id: user.id,
      source_row_number: row.sourceRowNumber,
      record_key: row.recordKey,
      period_month: row.periodMonth,
      unit_name: row.unitName,
      section_name: row.sectionName,
      cost_center: row.costCenter,
      business_group: row.businessGroup,
      service_group: row.serviceGroup,
      product_code: row.productCode,
      service_name: row.serviceName,
      revenue_amount: row.revenueAmount,
      source_is_blank: row.sourceIsBlank,
    }));

    for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
      const chunk = rows.slice(index, index + CHUNK_SIZE);
      await retry(async () => {
        const { error } = await supabase.from("revenue_import_rows").insert(chunk);
        if (error) throw error;
      });
      onProgress(Math.min(index + chunk.length, rows.length), rows.length);
    }

    const { count, error: countError } = await supabase
      .from("revenue_import_rows")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batch.id);
    if (countError || count !== rows.length) {
      throw new Error(`จำนวนแถวที่บันทึกไม่ตรงกัน: คาด ${rows.length}, ได้ ${count ?? 0}`);
    }

    const { error: finalizeError } = await supabase
      .from("import_batches")
      .update({ status: "validated", validated_at: new Date().toISOString() })
      .eq("id", batch.id);
    if (finalizeError) throw finalizeError;
    return batch.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "บันทึกข้อมูลไม่สำเร็จ";
    await supabase
      .from("import_batches")
      .update({ status: "failed", failure_message: message })
      .eq("id", batch.id);
    console.error({
      operation: "persist_import",
      code: "IMPORT_PERSIST_FAILED",
      batchId: batch.id,
      message,
    });
    throw error;
  }
}

export async function publishImport(batchId: string) {
  const { data, error } = await createClient().rpc("publish_import_batch", { p_batch_id: batchId });
  if (error) throw new Error(error.message);
  return data;
}
