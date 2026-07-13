const moneyFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const thaiMonthFormatter = new Intl.DateTimeFormat("th-TH", {
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return moneyFormatter.format(Number(value));
}

export function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${percentFormatter.format(Number(value))}%`;
}

export function formatThaiMonth(value: string): string {
  const date = new Date(`${value.slice(0, 7)}-01T00:00:00+07:00`);
  return thaiMonthFormatter.format(date);
}

export function formatThaiDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(typeof value === "string" ? new Date(value) : value);
}
