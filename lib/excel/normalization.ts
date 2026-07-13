const WHITESPACE_PATTERN = /[\s\u00a0]+/g;

export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).normalize("NFC").replace(WHITESPACE_PATTERN, " ").trim();
}

export function normalizeHeader(value: unknown): string {
  return normalizeText(value).toLocaleLowerCase("th-TH");
}

export function normalizeSheetName(value: string): string {
  return normalizeHeader(value);
}

export function isTotalLabel(value: string): boolean {
  return /\s+total$/i.test(normalizeText(value));
}

export function canonicalDimensionKey(values: readonly string[]): string {
  return JSON.stringify(values.map((value) => normalizeText(value)));
}
