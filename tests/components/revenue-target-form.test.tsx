import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RevenueTargetForm } from "@/components/targets/revenue-target-form";
import type { RevenueTargetSetup } from "@/lib/query/revenue-targets";

const setup: RevenueTargetSetup = {
  targetYear: 2026,
  hasYearData: true,
  throughMonth: 6,
  optionsSourceYear: 2026,
  yearOptions: [2027, 2026],
  groups: [{ code: "อป.", name: "ภาคตะวันออก", label: "อป. — ภาคตะวันออก" }],
  units: [{ name: "อป.2", groupCode: "อป." }],
  sections: [{ unitName: "อป.2", name: "ส่วนขายและบริการลูกค้า ระยอง" }],
  businessGroups: ["Digital"],
  serviceGroups: [{ businessGroup: "Digital", name: "Cloud" }],
  targets: [],
};

afterEach(cleanup);

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RevenueTargetForm setup={setup} editingTarget={null} onFinished={vi.fn()} />
    </QueryClientProvider>
  );
}

describe("RevenueTargetForm", () => {
  it("shows only the fields required by the selected organization and service scope", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByLabelText("กลุ่ม")).toBeInTheDocument();
    expect(screen.queryByLabelText("ฝ่าย")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("ระดับส่วนงาน"), "section");
    expect(screen.getByLabelText("ฝ่าย")).toBeInTheDocument();
    expect(screen.getByLabelText("ส่วนงาน")).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("ฝ่าย"), "อป.2");
    expect(screen.getByLabelText("ส่วนงาน")).toBeEnabled();

    await user.selectOptions(screen.getByLabelText("ขอบเขตบริการ"), "service_group");
    expect(screen.getByLabelText("กลุ่มธุรกิจ")).toBeInTheDocument();
    expect(screen.getByLabelText("กลุ่มบริการ")).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("กลุ่มธุรกิจ"), "Digital");
    expect(screen.getByLabelText("กลุ่มบริการ")).toBeEnabled();
  });

  it("previews million-baht input as an exact baht amount", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByRole("radio", { name: "ล้านบาท" })).toBeChecked();
    await user.type(screen.getByLabelText("เป้าหมายรายได้ทั้งปี (ล้านบาท)"), "26.36");

    expect(screen.getByText(/26,360,000\.00 บาท/)).toBeInTheDocument();
  });

  it("lets the user enter baht and previews the equivalent million-baht value", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("radio", { name: "บาท" }));
    await user.type(screen.getByLabelText("เป้าหมายรายได้ทั้งปี (บาท)"), "26,360,000");

    expect(screen.getByText(/26\.36 ล้านบาท/)).toBeInTheDocument();
  });

  it("clears a typed amount when the input unit changes", async () => {
    const user = userEvent.setup();
    renderForm();
    const millionBahtInput = screen.getByLabelText("เป้าหมายรายได้ทั้งปี (ล้านบาท)");

    await user.type(millionBahtInput, "26.36");
    await user.click(screen.getByRole("radio", { name: "บาท" }));

    expect(screen.getByLabelText("เป้าหมายรายได้ทั้งปี (บาท)")).toHaveValue("");
  });
});
