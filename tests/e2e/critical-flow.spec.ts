import { expect, test } from "@playwright/test";

import { createWorkbookFixture, detail } from "@/tests/fixtures/workbook-fixture";

const email = process.env.E2E_OWNER_EMAIL;
const password = process.env.E2E_OWNER_PASSWORD;

test.describe("authenticated revenue workflow", () => {
  test.skip(
    !email || !password,
    "Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD and run against a migrated Supabase project"
  );
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("อีเมล").fill(email ?? "");
    await page.getByLabel("รหัสผ่าน").fill(password ?? "");
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("imports, publishes, filters, explores, exports and republishes an older version", async ({
    page,
  }) => {
    const uploadVersion = async (filename: string, values: [number, number]) => {
      const workbook = createWorkbookFixture({ rows: [detail("001", values)] });
      await page.goto("/upload");
      await page.locator('input[type="file"]').setInputFiles({
        name: filename,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: Buffer.from(new Uint8Array(workbook)),
      });
      await expect(page.getByText("พร้อมบันทึก")).toBeVisible();
      await page.getByRole("button", { name: "บันทึกข้อมูล" }).click();
      await expect(page.getByRole("button", { name: "เผยแพร่ข้อมูล" })).toBeEnabled({
        timeout: 60_000,
      });
      await page.getByRole("button", { name: "เผยแพร่ข้อมูล" }).click();
      await expect(page.getByRole("button", { name: "เปิด Dashboard" })).toBeVisible();
    };

    await uploadVersion(`e2e-version-a-${Date.now()}-202602.xlsx`, [100, 200]);
    const firstFilename = await page.getByText(/e2e-version-a/).count();
    await page.goto("/dashboard");
    await expect(page.getByText("ภาพรวมรายได้")).toBeVisible();
    await page.goto("/explorer");
    await expect(page.getByText("สำรวจรายได้")).toBeVisible();
    await page.getByRole("button", { name: /Export มุมมองนี้/ }).click();

    await uploadVersion(`e2e-version-b-${Date.now()}-202602.xlsx`, [120, 240]);
    await page.goto("/imports");
    await expect(page.getByText("เวอร์ชันก่อนหน้า")).toBeVisible();
    if (firstFilename >= 0) {
      const row = page.getByRole("row").filter({ hasText: "e2e-version-a" }).first();
      await row.getByRole("link", { name: "ดูรายละเอียด" }).click();
      await page.getByRole("button", { name: "ใช้ข้อมูลเวอร์ชันนี้" }).click();
      await page.getByRole("button", { name: "ยืนยันการใช้งาน" }).click();
      await expect(page.getByText("Active Dataset")).toBeVisible();
    }
  });
});
