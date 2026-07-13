import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { parseMoneyCell } from "@/lib/excel/cells";
import { sha256Hex } from "@/lib/excel/hash";
import { parseRevenueWorkbook } from "@/lib/excel/parser";
import { createWorkbookFixture, detail, headers } from "@/tests/fixtures/workbook-fixture";

describe("Excel revenue parser", () => {
  it("finds the target sheet case-insensitively", async () => {
    const result = await parseRevenueWorkbook(
      createWorkbookFixture({ sheetName: "REPORT_รายเดือน" })
    );
    expect(result.summary.sheetName).toBe("REPORT_รายเดือน");
  });

  it.each([3, 10])("detects a header moved to row %s", async (headerRow) => {
    const result = await parseRevenueWorkbook(createWorkbookFixture({ headerRow }));
    expect(result.summary.headerRow).toBe(headerRow);
  });

  it("ignores an extra blank column before the header", async () => {
    const result = await parseRevenueWorkbook(createWorkbookFixture({ extraBlankColumn: true }));
    expect(result.summary.detailRowCount).toBe(1);
  });

  it("blocks a missing required header", async () => {
    const data = createWorkbookFixture({
      mutate(sheet, headerRow) {
        sheet[`G${headerRow}`] = { t: "s", v: "" };
      },
    });
    await expect(parseRevenueWorkbook(data)).rejects.toMatchObject({ name: "ExcelParseError" });
  });

  it("blocks an invalid month", async () => {
    await expect(
      parseRevenueWorkbook(createWorkbookFixture({ months: ["202601", "202613"] }))
    ).rejects.toThrow("รูปแบบเดือน");
  });

  it("blocks duplicate months", async () => {
    await expect(
      parseRevenueWorkbook(createWorkbookFixture({ months: ["202601", "202601"] }))
    ).rejects.toThrow("คอลัมน์เดือนซ้ำ");
  });

  it("blocks non-continuous months", async () => {
    await expect(
      parseRevenueWorkbook(createWorkbookFixture({ months: ["202601", "202603"] }))
    ).rejects.toThrow("เรียงต่อเนื่อง");
  });

  it("keeps numeric, text and leading-zero product codes as text", async () => {
    const data = createWorkbookFixture({
      rows: [detail(101), detail("A02"), detail("001")],
    });
    const result = await parseRevenueWorkbook(data);
    expect(result.details.map((row) => row.productCode)).toEqual(["101", "A02", "001"]);
  });

  it("rounds floating point values half-up to two decimals", async () => {
    const result = await parseRevenueWorkbook(
      createWorkbookFixture({ rows: [detail("001", [0.105, 0])] })
    );
    expect(result.details[0].monthlyAmounts["202601"]).toBe("0.11");
  });

  it("preserves blank versus numeric zero", async () => {
    const result = await parseRevenueWorkbook(
      createWorkbookFixture({ rows: [detail("001", [null, 0])] })
    );
    expect(result.details[0].monthlyAmounts).toEqual({ "202601": null, "202602": "0.00" });
    expect(result.details[0].sourceBlanks).toEqual({ "202601": true, "202602": false });
  });

  it("allows negative values and emits a warning", async () => {
    const result = await parseRevenueWorkbook(
      createWorkbookFixture({ rows: [detail("001", [-10, 20])] })
    );
    expect(result.summary.negativeRevenueCellCount).toBe(1);
    expect(result.summary.issues).toContainEqual(
      expect.objectContaining({ code: "NEGATIVE_REVENUE", severity: "warning" })
    );
  });

  it("excludes all subtotal levels", async () => {
    const totalRows = [
      ["หน่วย A", "ส่วน A", "CC001", "ธุรกิจ A", "บริการ A Total", null, null, 300, 100, 200],
      ["หน่วย A", "ส่วน A", "CC001", "ธุรกิจ A Total", null, null, null, 300, 100, 200],
      ["หน่วย A", "ส่วน A Total", null, null, null, null, null, 300, 100, 200],
      ["หน่วย A Total", null, null, null, null, null, null, 300, 100, 200],
    ];
    const result = await parseRevenueWorkbook(
      createWorkbookFixture({ rows: [detail(), ...totalRows] })
    );
    expect(result.excludedRows).toMatchObject({
      serviceGroupTotal: 1,
      businessGroupTotal: 1,
      sectionTotal: 1,
      unitTotal: 1,
    });
  });

  it("excludes note and blank rows", async () => {
    const result = await parseRevenueWorkbook(
      createWorkbookFixture({
        rows: [detail(), ["หมายเหตุ :", "ข้อมูลประกอบ"], [], ["หมายเหตุเพิ่มเติม"]],
      })
    );
    expect(result.excludedRows.noteOrBlank).toBe(3);
  });

  it("blocks duplicate dimension keys", async () => {
    const result = await parseRevenueWorkbook(
      createWorkbookFixture({ rows: [detail(), detail()] })
    );
    expect(result.summary.valid).toBe(false);
    expect(result.summary.duplicateDetailKeyCount).toBe(1);
  });

  it("blocks a row-total mismatch", async () => {
    const row = detail();
    row[7] = 999;
    const result = await parseRevenueWorkbook(createWorkbookFixture({ rows: [row] }));
    expect(result.summary.rowTotalMismatchCount).toBe(1);
  });

  it("blocks a grand-total mismatch", async () => {
    const grand = ["รวมทั้งสิ้น", null, null, null, null, null, null, 999, 999, 0];
    const result = await parseRevenueWorkbook(createWorkbookFixture({ rows: [detail(), grand] }));
    expect(result.summary.issues).toContainEqual(
      expect.objectContaining({ code: "GRAND_TOTAL_MISMATCH" })
    );
  });

  it("accepts a formula with a cached value", async () => {
    const data = createWorkbookFixture({
      mutate(sheet, headerRow) {
        sheet[`I${headerRow + 1}`] = { t: "n", f: "50+50", v: 100 } as XLSX.CellObject;
      },
    });
    const result = await parseRevenueWorkbook(data);
    expect(result.summary.valid).toBe(true);
  });

  it("blocks a formula without a cached value", () => {
    expect(() => parseMoneyCell({ t: "n", f: "50+50" } as XLSX.CellObject)).toThrow(
      "FORMULA_WITHOUT_CACHED_VALUE"
    );
  });

  it("normalizes Unicode whitespace in dimensions", async () => {
    const row = detail();
    row[0] = " หน่วย\u00a0  A ";
    const result = await parseRevenueWorkbook(createWorkbookFixture({ rows: [row] }));
    expect(result.details[0].unitName).toBe("หน่วย A");
  });

  it("creates deterministic SHA-256 hashes", async () => {
    expect(await sha256Hex("same-value")).toBe(await sha256Hex("same-value"));
    expect(await sha256Hex("same-value")).not.toBe(await sha256Hex("different-value"));
  });
});

describe("fixture headers", () => {
  it("contains every required dimension and total header", () => {
    expect(headers).toHaveLength(8);
  });
});
