"use client";

import { useState } from "react";
import { DownloadIcon, LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { OpAreaOverview } from "@/lib/query/op-area-overview";

export function OpAreaOverviewExportButton({ report }: { report: OpAreaOverview | null }) {
  const [isExporting, setIsExporting] = useState(false);

  async function exportReport() {
    if (!report) return;
    setIsExporting(true);
    try {
      const { downloadOpAreaOverviewWorkbook } =
        await import("@/lib/excel/op-area-overview-exporter");
      const filename = await downloadOpAreaOverviewWorkbook({ report });
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
      {isExporting ? "กำลังสร้าง Excel" : "Export Excel"}
    </Button>
  );
}
