import Decimal from "decimal.js";

export function sumRevenue(values: ReadonlyArray<string | null | undefined>): string {
  return values.reduce<Decimal>((sum, value) => sum.plus(value ?? 0), new Decimal(0)).toFixed(2);
}

export function previousMonth(period: string): string | null {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(4, 6));
  if (month === 1) return null;
  return `${year}${String(month - 1).padStart(2, "0")}`;
}

export function monthOverMonth(
  selected: string,
  previous: string | null
): { amount: string | null; percent: string | null } {
  if (previous === null) return { amount: null, percent: null };
  const currentValue = new Decimal(selected);
  const previousValue = new Decimal(previous);
  const amount = currentValue.minus(previousValue);
  if (previousValue.isZero()) return { amount: amount.toFixed(2), percent: null };
  return {
    amount: amount.toFixed(2),
    percent: amount.dividedBy(previousValue.abs()).times(100).toString(),
  };
}
