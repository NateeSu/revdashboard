"use client";

import { useState } from "react";
import { DownloadIcon, LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { RevenueMatrixReport } from "@/lib/query/reports";
import type { RevenueFilters } from "@/lib/revenue/types";

export function ReportExportButton({
  report,
  filters,
}: {
  report: RevenueMatrixReport | null;
  filters: RevenueFilters;
}) {
  const [isExporting, setIsExporting] = useState(false);

  async function exportReport() {
    if (!report) return;
    setIsExporting(true);
    try {
      const { downloadRevenueMatrixWorkbook } = await import("@/lib/excel/report-exporter");
      const filename = await downloadRevenueMatrixWorkbook({ report, filters });
      toast.success("Export Excel สำเร็จ", { description: filename });
    } catch (error) {
      toast.error("Export Excel ไม่สำเร็จ", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Button type="button" disabled={!report || isExporting} onClick={exportReport}>
      {isExporting ? (
        <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
      ) : (
        <DownloadIcon data-icon="inline-start" />
      )}
      {isExporting ? "กำลังสร้าง Excel" : "Export ตารางนี้เป็น Excel"}
    </Button>
  );
}
