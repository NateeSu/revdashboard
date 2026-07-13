import Decimal from "decimal.js";

import { MONEY_TOLERANCE } from "@/lib/excel/constants";
import type { ValidationIssue } from "@/lib/excel/types";

const tolerance = new Decimal(MONEY_TOLERANCE);

export function moneyMatches(actual: Decimal, expected: Decimal): boolean {
  return actual.minus(expected).abs().lessThanOrEqualTo(tolerance);
}

export function hasBlockingIssues(issues: readonly ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}

export function validationIssue(issue: ValidationIssue): ValidationIssue {
  return issue;
}
