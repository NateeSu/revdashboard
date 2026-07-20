"use client";

import { DownloadIcon, LoaderCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { RevenueRankingReport } from "@/lib/query/revenue-ranking";

export function RevenueRankingExportButton({ report }: { report: RevenueRankingReport | null }) {
  const [isExporting, setIsExporting] = useState(false);

  async function exportReport() {
    if (!report) return;
    setIsExporting(true);
    try {
      const { downloadRevenueRankingWorkbook } =
        await import("@/lib/excel/revenue-ranking-exporter");
      const filename = await downloadRevenueRankingWorkbook({ report });
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
      className="bg-amber-500 text-slate-950 hover:bg-amber-400"
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
