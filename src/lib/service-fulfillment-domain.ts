export const SERVICE_STATUSES = ["offered", "accepted", "in_progress", "delivered", "rework", "completed", "declined", "cancelled"] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];
export type ServiceAudience = "office" | "partner";
export type ServiceActor = { accountId: number; audience: ServiceAudience; workspaceId?: number };
export type ServiceResult = { status: number; body: Record<string, unknown> };

export const serviceStatusLabels: Record<ServiceStatus, string> = {
  offered: "ينتظر موافقة الشريك", accepted: "الشريك وافق", in_progress: "قيد التنفيذ",
  delivered: "ينتظر مراجعة التسليم", rework: "مطلوب تعديل", completed: "تسليم مقبول",
  declined: "الشريك اعتذر", cancelled: "ملغى",
};
export const serviceActionLabels: Record<string, string> = {
  created: "إنشاء التكليف", accept_assignment: "الشريك وافق", decline_assignment: "الشريك اعتذر",
  start_work: "بدء التنفيذ", deliver: "تسليم للمراجعة", accept_delivery: "قبول التسليم",
  request_rework: "طلب تعديل", cancel: "إلغاء الطلب",
};

export function servicePilotWorkspaceIds(raw = process.env.SERVICE_FULFILLMENT_PILOT_WORKSPACE_IDS ?? ""): number[] {
  if (!raw.trim()) return [];
  const parts = raw.split(",").map((part) => part.trim());
  if (parts.some((part) => !/^[1-9]\d*$/.test(part) || !Number.isSafeInteger(Number(part)) || Number(part) > 2_147_483_647)) return [];
  return [...new Set(parts.map(Number))];
}

export function isServicePilotWorkspace(workspaceId: number): boolean {
  return servicePilotWorkspaceIds().includes(workspaceId);
}

export function serviceId(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^[1-9]\d*$/.test(value))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= 2_147_483_647 ? number : null;
}

export function serviceMinor(value: unknown, positive = false): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+$/.test(value))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= (positive ? 1 : 0) ? number : null;
}

export function serviceText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean && clean.length <= max ? clean : null;
}

export function serviceMoneyState(agreed: number, collected: number, refunded: number): "unpaid" | "partial" | "collected" | "refunded" {
  if (collected > 0 && collected === refunded) return "refunded";
  const net = collected - refunded;
  if (agreed === 0 || net === agreed) return "collected";
  return net > 0 ? "partial" : "unpaid";
}

// Model B: supplier money is paid by the office. It is not a SILA expense.
export function serviceEconomics(fee: number, collected: number, refunded: number, directCost: number) {
  for (const value of [fee, collected, refunded, directCost]) {
    if (serviceMinor(value) === null) throw new Error("Service money exceeds safe precision.");
  }
  if (refunded > collected || collected - refunded > fee) throw new Error("Invalid service fee settlement.");
  return {
    feeAgreedMinor: fee,
    collectedMinor: collected,
    refundedMinor: refunded,
    netCollectedMinor: collected - refunded,
    directCostMinor: directCost,
    cashContributionMinor: collected - refunded - directCost,
    feeBalanceMinor: fee - collected + refunded,
    moneyState: serviceMoneyState(fee, collected, refunded),
  };
}

const transitions: Record<string, { audience: ServiceAudience; from: ServiceStatus[]; to: ServiceStatus }> = {
  accept_assignment: { audience: "partner", from: ["offered"], to: "accepted" },
  decline_assignment: { audience: "partner", from: ["offered"], to: "declined" },
  start_work: { audience: "partner", from: ["accepted", "rework"], to: "in_progress" },
  deliver: { audience: "partner", from: ["in_progress"], to: "delivered" },
  accept_delivery: { audience: "office", from: ["delivered"], to: "completed" },
  request_rework: { audience: "office", from: ["delivered"], to: "rework" },
  cancel: { audience: "office", from: ["offered", "accepted", "in_progress", "delivered", "rework"], to: "cancelled" },
};

export function serviceTransition(command: string, audience: ServiceAudience, current: ServiceStatus): ServiceStatus | null {
  const rule = transitions[command];
  return Object.hasOwn(transitions, command) && rule.audience === audience && rule.from.includes(current) ? rule.to : null;
}

export function serviceCommandKeys(command: unknown): readonly string[] | null {
  const shared = ["command", "requestId"];
  if (command === "create_order") return [...shared, "opportunityId", "supplierOptionId", "partnerEmail", "scope", "acceptanceCriteria", "qualificationReference", "dueAt", "silaFeeMinor", "confirmScopeSharing"];
  if (typeof command === "string" && Object.hasOwn(transitions, command)) return [...shared, "orderId", "expectedRevision", "note", "deliveryReference"];
  if (command === "record_fee" || command === "record_refund" || command === "record_cost") return [...shared, "orderId", "expectedRevision", "amountMinor", "reference", "note"];
  return null;
}

export type ServiceOrderView = {
  id: number; workspaceId: number; opportunityId: number; officeName: string; serviceName: string; status: ServiceStatus;
  revision: number; scope: string; acceptanceCriteria: string; dueAt: string; partnerName: string;
  supplierCostMinor: number; currency: string; lastNote: string | null; completedAt: string | null;
  overdue: boolean;
  finance?: ReturnType<typeof serviceEconomics> & { agencySellMinor: number; agencyMarginBeforeOperatingCostsMinor: number };
  deliveries: Array<{ id: number; reference: string; submittedAt: string }>;
  timeline: Array<{ action: string; note: string | null; createdAt: string }>;
  qualificationReference?: string;
  moneyEntries?: Array<{ kind: string; amountMinor: number; reference: string; note: string; createdAt: string }>;
  statusLink?: { id: number; expiresAt: string } | null;
};
