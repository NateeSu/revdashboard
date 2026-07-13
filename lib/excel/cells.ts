import Decimal from "decimal.js";
import type { CellObject, WorkSheet } from "xlsx";

import { normalizeText } from "@/lib/excel/normalization";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type MoneyCellResult = {
  value: Decimal | null;
  sourceIsBlank: boolean;
};

export function getCell(
  sheet: WorkSheet,
  rowIndex: number,
  columnIndex: number
): CellObject | undefined {
  const column = columnIndexToName(columnIndex);
  return sheet[`${column}${rowIndex + 1}`] as CellObject | undefined;
}

function columnIndexToName(index: number): string {
  let result = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

export function readTextCell(cell: CellObject | undefined, preferFormatted = false): string {
  if (!cell) return "";
  const value = preferFormatted && cell.w !== undefined ? cell.w : cell.v;
  return normalizeText(value);
}

export function parseMoneyCell(cell: CellObject | undefined): MoneyCellResult {
  if (!cell || cell.v === null || cell.v === undefined || normalizeText(cell.v) === "") {
    if (cell?.f) throw new Error("FORMULA_WITHOUT_CACHED_VALUE");
    return { value: null, sourceIsBlank: true };
  }
  if (cell.f && (cell.v === null || cell.v === undefined)) {
    throw new Error("FORMULA_WITHOUT_CACHED_VALUE");
  }

  const raw = typeof cell.v === "string" ? cell.v.trim() : String(cell.v);
  const parenthesized = /^\(.*\)$/.test(raw);
  const cleaned = raw.replace(/[฿,\s]/g, "").replace(/^\((.*)\)$/, "$1");
  try {
    const parsed = new Decimal(cleaned || "0");
    const signed = parenthesized ? parsed.negated() : parsed;
    const rounded = signed.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    return {
      value: rounded.isZero() ? new Decimal(0) : rounded,
      sourceIsBlank: false,
    };
  } catch {
    throw new Error(`INVALID_MONEY:${raw}`);
  }
}

export function decimalToMoney(value: Decimal): string {
  return value.isZero() ? "0.00" : value.toFixed(2);
}
