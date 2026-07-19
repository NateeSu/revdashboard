"use client";

import { useState } from "react";
import { DownloadIcon, LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { OpScopedRevenueOverview } from "@/lib/query/op-scoped-revenue";
import { getOpScopedReportConfig } from "@/lib/revenue/op-scoped-report-config";

export function OpScopedRevenueExportButton({
  report,
}: {
  report: OpScopedRevenueOverview | null;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const config = report ? getOpScopedReportConfig(report.scope.key) : null;

  async function exportReport() {
    if (!report) return;
    setIsExporting(true);
    try {
      const { downloadOpScopedRevenueWorkbook } =
        await import("@/lib/excel/op-scoped-revenue-exporter");
      const filename = await downloadOpScopedRevenueWorkbook({ report });
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
    <Button
      type="button"
      className="text-white hover:brightness-90"
      style={{ backgroundColor: config?.theme.currentStrong ?? "#0F766E" }}
      disabled={!report || isExporting}
      onClick={exportReport}
    >
      {isExporting ? (
        <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
      ) : (
        <DownloadIcon data-icon="inline-start" />
      )}
      {isExporting ? "กำลังสร้าง Excel" : "Export Excel"}
    </Button>
  );
}
