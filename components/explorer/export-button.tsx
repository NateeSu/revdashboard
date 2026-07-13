"use client";

import { useRef, useState } from "react";
import { DownloadIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ExplorerLevel } from "@/lib/query/explorer";
import type { RevenueFilters } from "@/lib/revenue/types";

export function ExportButton({
  year,
  month,
  level,
  filters,
}: {
  year: number;
  month: number;
  level: ExplorerLevel;
  filters: RevenueFilters;
}) {
  const [stage, setStage] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  async function start() {
    const controller = new AbortController();
    controllerRef.current = controller;
    setStage("กำลังเตรียมข้อมูล");
    try {
      const { exportRevenueWorkbook } = await import("@/lib/excel/exporter");
      const filename = await exportRevenueWorkbook({
        year,
        month,
        level,
        filters,
        signal: controller.signal,
        onProgress: (nextStage) => setStage(nextStage),
      });
      toast.success("Export Excel สำเร็จ", { description: filename });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError")
        toast("ยกเลิกการ Export แล้ว");
      else
        toast.error("Export Excel ไม่สำเร็จ", {
          description: error instanceof Error ? error.message : undefined,
        });
    } finally {
      controllerRef.current = null;
      setStage(null);
    }
  }

  if (stage) {
    return (
      <Button variant="outline" onClick={() => controllerRef.current?.abort()}>
        <XIcon data-icon="inline-start" />
        {stage} · ยกเลิก
      </Button>
    );
  }
  return (
    <Button variant="outline" onClick={start}>
      <DownloadIcon data-icon="inline-start" />
      Export มุมมองนี้
    </Button>
  );
}
