"use client";

import { useRef, useState } from "react";
import { FileSpreadsheetIcon, UploadCloudIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function validateSelectedFile(file: File, maxSizeMb: number): string | null {
  if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) return "รองรับเฉพาะไฟล์ .xlsx เท่านั้น";
  if (file.size === 0) return "ไฟล์ว่างเปล่า กรุณาเลือกไฟล์ใหม่";
  if (file.size > maxSizeMb * 1024 * 1024) return `ไฟล์มีขนาดเกิน ${maxSizeMb} MB`;
  if (file.type && file.type !== XLSX_MIME && file.type !== "application/octet-stream") {
    return "ชนิดไฟล์ไม่ตรงกับ Excel .xlsx";
  }
  return null;
}

export function UploadDropzone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={cn(
        "flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-8 text-center transition-colors",
        dragging ? "border-primary bg-accent" : "border-border bg-muted/20"
      )}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      <div className="grid size-14 place-items-center rounded-xl bg-accent text-primary">
        {dragging ? <FileSpreadsheetIcon /> : <UploadCloudIcon />}
      </div>
      <div className="flex max-w-md flex-col gap-1">
        <p className="font-heading text-lg font-medium">ลากไฟล์ Excel มาวางที่นี่</p>
        <p className="text-sm text-muted-foreground">
          รองรับไฟล์ .xlsx และประมวลผลใน Browser ของคุณ
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <FileSpreadsheetIcon data-icon="inline-start" />
        เลือกไฟล์จากเครื่อง
      </Button>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
