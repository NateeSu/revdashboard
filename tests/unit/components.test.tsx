import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/auth/login-form";
import { KpiCard } from "@/components/dashboard/dashboard-view";
import { MultiSelectFilter } from "@/components/filters/multi-select-filter";
import { ImportStatusBadge } from "@/components/imports/status-badge";
import { UploadDropzone, validateSelectedFile } from "@/components/upload/upload-dropzone";
import { ValidationReview } from "@/components/upload/upload-workflow";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { parseRevenueWorkbook } from "@/lib/excel/parser";
import { createWorkbookFixture, detail } from "@/tests/fixtures/workbook-fixture";

const replace = vi.fn();
const refresh = vi.fn();
const signInWithPassword = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashboard",
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}));

afterEach(cleanup);

describe("login form", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens the organization overview after a successful login", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(document.querySelector("#identifier") as HTMLInputElement, "owner");
    await user.type(document.querySelector("#password") as HTMLInputElement, "password");
    await user.click(document.querySelector('button[type="submit"]') as HTMLButtonElement);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/organization-overview"));
  });

  it("renders Thai validation messages", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
    expect(await screen.findByText("กรุณากรอกชื่อผู้ใช้หรืออีเมล")).toBeInTheDocument();
    expect(screen.getByText("กรุณากรอกรหัสผ่าน")).toBeInTheDocument();
  });
});

describe("upload components", () => {
  it("validates file extension, empty files and size", () => {
    expect(validateSelectedFile(new File(["x"], "report.csv", { type: "text/csv" }), 10)).toContain(
      ".xlsx"
    );
    expect(validateSelectedFile(new File([], "report.xlsx"), 10)).toContain("ว่างเปล่า");
    expect(
      validateSelectedFile(new File([new Uint8Array(2 * 1024 * 1024)], "report.xlsx"), 1)
    ).toContain("เกิน 1 MB");
  });

  it("accepts a dropped xlsx file", () => {
    const onFile = vi.fn();
    render(<UploadDropzone onFile={onFile} />);
    const file = new File(["xlsx"], "report.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    fireEvent.drop(
      screen.getByText("ลากไฟล์ Excel มาวางที่นี่").parentElement?.parentElement as HTMLElement,
      {
        dataTransfer: { files: [file] },
      }
    );
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("renders validation warnings and summary values", async () => {
    const result = await parseRevenueWorkbook(
      createWorkbookFixture({ rows: [detail("001", [-10, 20])] }),
      { filename: "report_202602.xlsx" }
    );
    const file = new File(["fixture"], "report_202602.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    render(<ValidationReview file={file} result={result} />);
    expect(screen.getByText("พร้อมบันทึก")).toBeInTheDocument();
    expect(screen.getAllByText(/พบรายได้ติดลบ/).length).toBeGreaterThan(0);
    expect(screen.getByText("สรุปรายได้รายเดือน")).toBeInTheDocument();
  });
});

describe("dashboard and status components", () => {
  it("renders KPI value and comparison state", () => {
    render(
      <TooltipProvider>
        <KpiCard
          label="รายได้สะสม"
          value="3,019,409,723.75 บาท"
          description="ผลรวม"
          direction="up"
        />
      </TooltipProvider>
    );
    expect(screen.getByText("3,019,409,723.75 บาท")).toBeInTheDocument();
    expect(screen.getByText("เทียบเดือนก่อน")).toBeInTheDocument();
  });

  it("renders every import status label", () => {
    const { rerender } = render(<ImportStatusBadge status="uploading" />);
    expect(screen.getByText("กำลังบันทึก")).toBeInTheDocument();
    rerender(<ImportStatusBadge status="published" />);
    expect(screen.getByText("ใช้งานอยู่")).toBeInTheDocument();
    rerender(<ImportStatusBadge status="failed" />);
    expect(screen.getByText("ไม่สำเร็จ")).toBeInTheDocument();
  });

  it("updates multi-select filter choices", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiSelectFilter
        label="หน่วยงาน"
        options={["นป.1", "นป.2"]}
        values={[]}
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole("button", { name: /หน่วยงาน/ }));
    await user.click(await screen.findByText("นป.1"));
    expect(onChange).toHaveBeenCalledWith(["นป.1"]);
  });
});

describe("confirmation dialog", () => {
  it("shows a title and cancel action before destructive work", async () => {
    const user = userEvent.setup();
    render(
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="destructive" />}>ลบข้อมูล</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบข้อมูล</AlertDialogTitle>
            <AlertDialogDescription>การดำเนินการนี้ย้อนกลับไม่ได้</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
    await user.click(screen.getByRole("button", { name: "ลบข้อมูล" }));
    await waitFor(() => expect(screen.getByText("ยืนยันการลบข้อมูล")).toBeVisible());
    expect(screen.getByRole("button", { name: "ยกเลิก" })).toBeInTheDocument();
  });
});
