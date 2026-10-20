import type { AgentTrust, AgentTrustClaim, Offer } from "../api/types";

/**
 * Mobile evidence policy: never promote a "reviewed" object to an unqualified
 * identity-verification claim. Expired, malformed or future-dated evidence is
 * not represented as currently reviewed.
 */
function parseEvidenceTime(value: string, endOfDay = false): number | null {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const input = dateOnly
    ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
    : value;
  const time = Date.parse(input);
  return Number.isFinite(time) ? time : null;
}

function hasValidExpiry(value: string | null, now: number): boolean {
  if (!value) return true;
  const expiry = parseEvidenceTime(value, true);
  return expiry !== null && expiry >= now;
}

export type EvidenceTone = "verified" | "warn" | "neutral";

export interface AgentEvidence {
  tone: EvidenceTone;
  label: string;
  claims: AgentTrustClaim[];
  reviewedAt: string | null;
  limitations: string[];
}

export function agentEvidence(trust: AgentTrust | undefined, now = Date.now()): AgentEvidence {
  if (!trust || trust.status !== "reviewed") {
    return { tone: "neutral", label: "نطاق المراجعة غير متاح", claims: [], reviewedAt: null, limitations: [] };
  }
  const reviewedAt = parseEvidenceTime(trust.reviewedAt);
  if (reviewedAt === null || reviewedAt > now) {
    return { tone: "warn", label: "تاريخ المراجعة غير مؤكد", claims: [], reviewedAt: null, limitations: trust.limitations };
  }
  if (!hasValidExpiry(trust.validUntil, now)) {
    return { tone: "warn", label: "صلاحية المراجعة غير مؤكدة", claims: [], reviewedAt: trust.reviewedAt, limitations: trust.limitations };
  }
  const claims = trust.claims.filter((claim) => {
    const date = parseEvidenceTime(claim.verifiedAt);
    return date !== null && date <= now && hasValidExpiry(claim.validUntil, now);
  });
  if (!claims.length) {
    return { tone: "warn", label: "لا توجد أدلة مراجعة سارية", claims: [], reviewedAt: trust.reviewedAt, limitations: trust.limitations };
  }
  return {
    tone: "verified",
    label: "أدلة مراجعة سارية ضمن نطاق محدد",
    claims,
    reviewedAt: trust.reviewedAt,
    limitations: trust.limitations,
  };
}

export function offerAvailability(offer: Pick<Offer, "status" | "expiresAt">, now = Date.now()) {
  if (offer.status !== "published") return { canRequest: false, label: "العرض غير منشور" };
  if (!hasValidExpiry(offer.expiresAt, now)) {
    return { canRequest: false, label: "صلاحية العرض غير مؤكدة — اطلب تحديثه" };
  }
  return { canRequest: true, label: offer.expiresAt ? "عرض منشور حتى التاريخ المحدد" : "عرض منشور · تاريخ الانتهاء غير متاح" };
}
