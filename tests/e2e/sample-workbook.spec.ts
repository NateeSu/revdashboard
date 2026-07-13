import { existsSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

const email = process.env.E2E_OWNER_EMAIL;
const password = process.env.E2E_OWNER_PASSWORD;
const sampleWorkbook = path.resolve(process.cwd(), "revenue_report_202605.xlsx");

test("imports and publishes the local acceptance workbook", async ({ page }) => {
  test.skip(
    !email || !password || !existsSync(sampleWorkbook),
    "Set E2E credentials and place revenue_report_202605.xlsx at the project root"
  );
  test.setTimeout(120_000);

  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email ?? "");
  await page.getByRole("textbox", { name: "รหัสผ่าน" }).fill(password ?? "");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/upload");
  await page.waitForLoadState("networkidle");
  await page.locator('input[type="file"]').setInputFiles(sampleWorkbook);
  await expect(page.getByText("พร้อมบันทึก")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "บันทึกข้อมูล" }).click();
  await expect(page.getByRole("button", { name: "เผยแพร่ข้อมูล" })).toBeEnabled({
    timeout: 60_000,
  });
  await page.getByRole("button", { name: "เผยแพร่ข้อมูล" }).click();
  await page.getByRole("button", { name: "เปิด Dashboard" }).click();

  await expect(page.getByRole("heading", { name: "ภาพรวมรายได้", level: 1 })).toBeVisible();
  await expect(page.getByText("Active Dataset").first()).toBeVisible();
});
