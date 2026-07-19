"use client";

import { useState } from "react";
import { DownloadIcon, LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { BroadbandRevenueOverview } from "@/lib/query/broadband-revenue";

export function BroadbandRevenueExportButton({
  report,
}: {
  report: BroadbandRevenueOverview | null;
}) {
  const [isExporting, setIsExporting] = useState(false);

  async function exportReport() {
    if (!report) return;
    setIsExporting(true);
    try {
      const { downloadBroadbandRevenueWorkbook } =
        await import("@/lib/excel/broadband-revenue-exporter");
      const filename = await downloadBroadbandRevenueWorkbook({ report });
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
      className="bg-teal-700 text-white hover:bg-teal-800"
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
