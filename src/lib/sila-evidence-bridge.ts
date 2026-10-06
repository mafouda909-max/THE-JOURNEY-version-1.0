import type {
  AdvisorClaimResolution,
  AdvisorClaimTopic,
  AdvisorDecisionClaim,
  AdvisorDecisionDossier,
} from "./readiness-decision-dossier";
import type { SilaAdvisorResearchNeed } from "./sila-advisor-brain";

export type SilaEvidenceStatus =
  | "NO_EVIDENCE"
  | "READY"
  | "PARTIAL"
  | "CONFLICTED";

export interface SilaEvidencePacket {
  claimId: string;
  topic: AdvisorClaimTopic;
  topicLabel: string;
  statement: string;
  sourceType: string;
  sourceLabel: string;
  sourceUrl: string | null;
  authorityLevel: number;
  evidenceStatus: AdvisorDecisionClaim["evidenceStatus"];
  resolution: AdvisorClaimResolution;
  scope: string[];
  checkedAt: string | null;
  validUntil: string | null;
  limitations: string[];
  decisionGrade: boolean;
}

export interface SilaEvidenceReview {
  status: SilaEvidenceStatus;
  packets: SilaEvidencePacket[];
  supportedTopics: AdvisorClaimTopic[];
  unresolvedTopics: AdvisorClaimTopic[];
  conflictedTopics: AdvisorClaimTopic[];
  decisionGradePacketCount: number;
  canSupportDecision: boolean;
  blockers: string[];
  summary: string;
}

function uniqueTopics(values: AdvisorClaimTopic[]): AdvisorClaimTopic[] {
  return Array.from(new Set(values));
}

function decisionGroups(dossier: AdvisorDecisionDossier) {
  return dossier.groups.filter((group) => group.topic !== "research_context");
}

function packetFromClaim(
  claim: AdvisorDecisionClaim,
  dossier: AdvisorDecisionDossier,
): SilaEvidencePacket {
  const resolution =
    dossier.groups.find((group) => group.key === claim.scopeKey)?.resolution ?? "UNKNOWN";
  const decisionGrade =
    resolution === "SUPPORTED" &&
    claim.evidenceStatus === "VERIFIED" &&
    claim.authorityLevel >= 4;

  return {
    claimId: claim.id,
    topic: claim.topic,
    topicLabel: claim.topicLabel,
    statement: claim.statement,
    sourceType: claim.sourceType,
    sourceLabel: claim.sourceLabel,
    sourceUrl: claim.sourceUrl,
    authorityLevel: claim.authorityLevel,
    evidenceStatus: claim.evidenceStatus,
    resolution,
    scope: [...claim.scope],
    checkedAt: claim.checkedAt,
    validUntil: claim.validUntil,
    limitations: [...claim.limitations],
    decisionGrade,
  };
}

export function reviewSilaDecisionEvidence(
  dossier: AdvisorDecisionDossier | null | undefined,
): SilaEvidenceReview {
  if (!dossier) {
    return {
      status: "NO_EVIDENCE",
      packets: [],
      supportedTopics: [],
      unresolvedTopics: [],
      conflictedTopics: [],
      decisionGradePacketCount: 0,
      canSupportDecision: false,
      blockers: ["لا يوجد Decision Dossier موثوق مولّد من محرك الجاهزية."],
      summary: "لا توجد أدلة قرار متاحة بعد؛ صلة يجب أن تظل في وضع الاستيضاح أو طلب المصدر.",
    };
  }

  const groups = decisionGroups(dossier);
  const supportedTopics = uniqueTopics(
    groups
      .filter((group) => group.resolution === "SUPPORTED")
      .map((group) => group.topic),
  );
  const unresolvedTopics = uniqueTopics(
    groups
      .filter((group) => ["UNCONFIRMED", "UNKNOWN"].includes(group.resolution))
      .map((group) => group.topic),
  );
  const conflictedTopics = uniqueTopics(
    groups
      .filter((group) => group.resolution === "CONFLICTED")
      .map((group) => group.topic),
  );
  const packets = dossier.claims.map((claim) => packetFromClaim(claim, dossier));
  const decisionGradePacketCount = packets.filter((packet) => packet.decisionGrade).length;

  let status: SilaEvidenceStatus;
  if (groups.length === 0) {
    status = "NO_EVIDENCE";
  } else if (conflictedTopics.length > 0) {
    status = "CONFLICTED";
  } else if (unresolvedTopics.length === 0 && supportedTopics.length > 0) {
    status = "READY";
  } else {
    status = "PARTIAL";
  }

  const blockers: string[] = [];
  if (conflictedTopics.length > 0) {
    blockers.push(
      ...conflictedTopics.map((topic) => `تعارض أدلة في: ${topic}`),
    );
  }
  if (unresolvedTopics.length > 0) {
    blockers.push(
      ...unresolvedTopics.map((topic) => `دليل غير مكتمل أو غير مؤكد في: ${topic}`),
    );
  }
  if (status === "NO_EVIDENCE") {
    blockers.push("لا توجد مجموعة ادعاءات قرار قابلة للتقييم.");
  }

  const canSupportDecision =
    status === "READY" &&
    decisionGradePacketCount > 0;

  const summary =
    status === "READY"
      ? `الأدلة جاهزة ضمن النطاق الحالي: ${supportedTopics.length} موضوع مدعوم و${decisionGradePacketCount} حزمة قرار موثقة.`
      : status === "CONFLICTED"
        ? `الأدلة متضاربة في ${conflictedTopics.length} موضوع؛ لا يجوز تحويلها إلى قرار نهائي قبل الحسم.`
        : status === "PARTIAL"
          ? `الأدلة جزئية: ${supportedTopics.length} موضوع مدعوم و${unresolvedTopics.length} يحتاج تأكيدًا.`
          : "لا توجد أدلة قرار متاحة بعد.";

  return {
    status,
    packets,
    supportedTopics,
    unresolvedTopics,
    conflictedTopics,
    decisionGradePacketCount,
    canSupportDecision,
    blockers,
    summary,
  };
}

export function silaEvidenceSatisfiesResearchNeed(
  need: SilaAdvisorResearchNeed,
  review: SilaEvidenceReview,
): boolean {
  if (review.status === "CONFLICTED" || review.status === "NO_EVIDENCE") return false;

  if (need.id === "entry-rules") {
    return review.supportedTopics.includes("entry_visa");
  }

  if (need.id === "transit-risk") {
    return (
      review.supportedTopics.includes("transit") ||
      review.supportedTopics.includes("transit_route")
    );
  }

  return false;
}
