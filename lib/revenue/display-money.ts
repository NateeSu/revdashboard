import { formatMoney } from "@/lib/revenue/formatters";

export type RevenueDisplayUnit = "million-baht" | "baht";

export function revenueDisplayUnitLabel(unit: RevenueDisplayUnit): string {
  return unit === "baht" ? "บาท" : "ล้านบาท";
}

export function revenueDisplayUnitShortLabel(unit: RevenueDisplayUnit): string {
  return unit === "baht" ? "บาท" : "ลบ.";
}

export function bahtToDisplayValue(value: string | null, unit: RevenueDisplayUnit): number | null {
  if (value === null) return null;
  const amount = Number(value);
  return unit === "baht" ? amount : amount / 1_000_000;
}

export function formatBahtForDisplay(value: string | null, unit: RevenueDisplayUnit): string {
  const amount = bahtToDisplayValue(value, unit);
  return amount === null ? "—" : formatMoney(amount);
}
