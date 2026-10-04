export const SERVICE_OPERATION_COUNTS = [
  "assignments", "opportunities", "accepted", "awaitingPartner", "inProgress",
  "awaitingReview", "completed", "overdue", "reworked", "evaluatedAccepted",
  "onTimeCompleted", "completedWithFeeBalance", "paidOpportunities",
] as const;

export type ServiceOperationCounts = Record<(typeof SERVICE_OPERATION_COUNTS)[number], number>;
export type ServiceCurrencyTotals = {
  currency: string; collectedMinor: string; refundedMinor: string; directCostMinor: string;
  netCollectedMinor: string; cashContributionMinor: string; completedFeeBalanceMinor: string;
};
export type ServiceOperationsReport = {
  workspaceId: number; observedAt: string; scope: "all-recorded-assignments";
  counts: ServiceOperationCounts; currencies: ServiceCurrencyTotals[];
  rates: { onTime: number | null; rework: number | null };
};

export function serviceRate(numerator: number, denominator: number): number | null {
  if (![numerator, denominator].every((value) => Number.isSafeInteger(value) && value >= 0) || numerator > denominator) {
    throw new Error("Invalid service metric denominator.");
  }
  return denominator === 0 ? null : numerator / denominator;
}

// Aggregates may exceed Number.MAX_SAFE_INTEGER; keep exact minor-unit strings.
export function exactServiceMoney(minor: string, currency: string): string {
  if (!/^-?\d+$/.test(minor) || !/^[A-Z]{3}$/.test(currency)) throw new Error("Invalid recorded money.");
  const value = BigInt(minor);
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  const whole = absolute / BigInt(100);
  const fraction = String(absolute % BigInt(100)).padStart(2, "0");
  return (negative ? "-" : "") + new Intl.NumberFormat("en-US").format(whole) + "." + fraction + " " + currency;
}
