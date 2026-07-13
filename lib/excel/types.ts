export type ValidationSeverity = "error" | "warning" | "info";

export type ValidationIssue = {
  code: string;
  severity: ValidationSeverity;
  message: string;
  sourceRow?: number;
  field?: string;
  expected?: string | number | null;
  actual?: string | number | null;
};

export type DimensionValues = {
  unitName: string;
  sectionName: string;
  costCenter: string;
  businessGroup: string;
  serviceGroup: string;
  productCode: string;
  serviceName: string;
};

export type ParsedDetailRow = DimensionValues & {
  sourceRowNumber: number;
  recordKey: string;
  sourceTotal: string;
  calculatedYtd: string;
  monthlyAmounts: Record<string, string | null>;
  sourceBlanks: Record<string, boolean>;
};

export type RevenueRow = DimensionValues & {
  sourceRowNumber: number;
  recordKey: string;
  periodMonth: string;
  revenueAmount: string | null;
  sourceIsBlank: boolean;
};

export type ExcludedRowType =
  | "serviceGroupTotal"
  | "businessGroupTotal"
  | "sectionTotal"
  | "unitTotal"
  | "grandTotal"
  | "noteOrBlank";

export type ExcludedRowCounts = Record<ExcludedRowType, number>;

export type DimensionCounts = {
  units: number;
  sections: number;
  costCenters: number;
  businessGroups: number;
  serviceGroups: number;
  products: number;
  services: number;
};

export type ValidationSummary = {
  valid: boolean;
  sheetName: string;
  headerRow: number;
  reportYear: number;
  reportEndMonth: string;
  monthColumns: string[];
  sourceRowCount: number;
  detailRowCount: number;
  generatedRevenueRowCount: number;
  serviceGroupTotalCount: number;
  businessGroupTotalCount: number;
  sectionTotalCount: number;
  unitTotalCount: number;
  grandTotalCount: number;
  ignoredNoteOrBlankCount: number;
  blankRevenueCellCount: number;
  zeroRevenueCellCount: number;
  negativeRevenueCellCount: number;
  negativeRevenueAmount: string;
  currentMonthRevenue: string;
  ytdRevenue: string;
  duplicateDetailKeyCount: number;
  rowTotalMismatchCount: number;
  issues: ValidationIssue[];
};

export type ParseResult = {
  fileHash: string;
  summary: ValidationSummary;
  details: ParsedDetailRow[];
  revenueRows: RevenueRow[];
  monthlyTotals: Array<{ period: string; revenue: string }>;
  excludedRows: ExcludedRowCounts;
  dimensionCounts: DimensionCounts;
};

export type ParseWorkbookOptions = {
  filename?: string;
};

export class ExcelParseError extends Error {
  constructor(
    message: string,
    readonly issues: ValidationIssue[]
  ) {
    super(message);
    this.name = "ExcelParseError";
  }
}
