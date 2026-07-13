"use client";

import { useEffect } from "react";
import { CircleAlertIcon, RefreshCwIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error({
      operation: "render",
      code: "UI_BOUNDARY",
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <main className="grid min-h-svh place-items-center p-6">
      <Alert variant="destructive" className="max-w-lg">
        <CircleAlertIcon />
        <AlertTitle>ไม่สามารถแสดงหน้านี้ได้</AlertTitle>
        <AlertDescription>
          เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองอีกครั้ง หากยังพบปัญหาให้แจ้งรหัส{" "}
          {error.digest ?? "UI_BOUNDARY"}
        </AlertDescription>
        <Button variant="outline" onClick={reset} className="mt-3 w-fit">
          <RefreshCwIcon data-icon="inline-start" />
          ลองอีกครั้ง
        </Button>
      </Alert>
    </main>
  );
}
