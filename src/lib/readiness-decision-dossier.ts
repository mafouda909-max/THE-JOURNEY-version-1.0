import { validTravelDate, type Evidence } from "@/lib/evidence";
import type { AdvisorLiveResearch } from "@/lib/readiness-advisor";
import type {
  DynamicChecklistItem,
  TravelReadinessInput,
  TravelReadinessResult,
} from "@/lib/travel-readiness";
import { missingTransitRouteQuestions } from "@/lib/transit-route-intelligence";

export type AdvisorClaimTopic =
  | "passport_validity"
  | "entry_visa"
  | "transit"
  | "transit_route"
  | "health"
  | "documents"
  | "research_context";

export type AdvisorClaimPolarity = "YES" | "NO" | "UNKNOWN" | "NEUTRAL";
export type AdvisorClaimResolution =
  | "SUPPORTED"
  | "UNCONFIRMED"
  | "CONFLICTED"
  | "UNKNOWN";

export interface AdvisorDecisionClaim {
  id: string;
  topic: AdvisorClaimTopic;
  topicLabel: string;
  statement: string;
  polarity: AdvisorClaimPolarity;
  sourceType: string;
  sourceLabel: string;
  sourceUrl: string | null;
  authorityLevel: 0 | 1 | 2 | 3 | 4 | 5;
  evidenceStatus: Evidence["status"];
  scope: string[];
  scopeKey: string;
  checkedAt: string | null;
  validUntil: string | null;
  limitations: string[];
}

export interface AdvisorClaimGroup {
  key: string;
  topic: AdvisorClaimTopic;
  topicLabel: string;
  resolution: AdvisorClaimResolution;
  claimIds: string[];
  sourceCount: number;
  reason: string;
}

export interface AdvisorDecisionQuestion {
  id: string;
  label: string;
  why: string;
  topic: AdvisorClaimTopic;
  kind?: "text" | "choice" | "number";
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface AdvisorDecisionDossier {
  claims: AdvisorDecisionClaim[];
  groups: AdvisorClaimGroup[];
  supported: string[];
  unresolved: string[];
  conflicts: string[];
  followUpQuestions: AdvisorDecisionQuestion[];
  generatedAt: string;
}

function authority(sourceType: string, status: Evidence["status"]): 0 | 1 | 2 | 3 | 4 | 5 {
  if (status === "VERIFIED" && ["VERIFIED", "SOURCE_REPORTED"].includes(sourceType)) return 5;
  if (sourceType === "VERIFIED") return 5;
  if (sourceType === "SOURCE_REPORTED") return 4;
  if (sourceType === "AGENT_REPORTED" || sourceType === "TRAVELER_REPORTED") return 2;
  if (sourceType === "AI_INFERRED") return 1;
  return 0;
}

function scopeKey(topic: AdvisorClaimTopic, scope: string[]): string {
  const normalized = scope
    .map((item) => item.trim().toLocaleLowerCase("ar-EG"))
    .filter(Boolean)
    .sort()
    .join("|");
  return `${topic}::${normalized || "unspecified"}`;
}

function itemTopic(item: DynamicChecklistItem): {
  topic: AdvisorClaimTopic;
  label: string;
  polarity: AdvisorClaimPolarity;
} {
  if (item.id === "passport_validity") {
    return { topic: "passport_validity", label: "صلاحية الجواز", polarity: item.status === "BLOCKED" ? "NO" : "NEUTRAL" };
  }
  if (item.id === "visa_requirement") {
    return {
      topic: "entry_visa",
      label: "التأشيرة المسبقة",
      polarity: item.status === "PENDING_ACTION" ? "YES" : item.status === "VERIFIED" ? "NO" : "UNKNOWN",
    };
  }
  if (item.category === "TRANSIT") return { topic: "transit", label: "الترانزيت", polarity: "UNKNOWN" };
  if (item.category === "HEALTH") return { topic: "health", label: "الصحة والتأمين", polarity: "UNKNOWN" };
  return { topic: "documents", label: "المستندات", polarity: item.status === "VERIFIED" ? "YES" : "UNKNOWN" };
}

function checklistClaim(item: DynamicChecklistItem): AdvisorDecisionClaim {
  const mapped = itemTopic(item);
  return {
    id: `checklist:${item.id}`,
    topic: mapped.topic,
    topicLabel: mapped.label,
    statement: item.title,
    polarity: mapped.polarity,
    sourceType: item.evidence.source.type,
    sourceLabel: item.evidence.source.label,
    sourceUrl: item.evidence.source.reference,
    authorityLevel: authority(item.evidence.source.type, item.evidence.status),
    evidenceStatus: item.evidence.status,
    scope: [...item.evidence.scope],
    scopeKey: scopeKey(mapped.topic, item.evidence.scope),
    checkedAt: item.evidence.checkedAt,
    validUntil: item.evidence.validUntil,
    limitations: [...item.evidence.limitations],
  };
}

function researchClaims(research: AdvisorLiveResearch): AdvisorDecisionClaim[] {
  if (research.sources.length === 0) return [];
  return research.sources.map((source, index) => ({
    id: `research:${index + 1}`,
    topic: "research_context",
    topicLabel: "البحث المباشر",
    statement: research.answer?.trim() || source.title,
    polarity: "NEUTRAL",
    sourceType: "SOURCE_REPORTED",
    sourceLabel: source.title,
    sourceUrl: source.url,
    authorityLevel: 3,
    evidenceStatus: "UNCONFIRMED",
    scope: ["سياق بحث مباشر؛ لم يُرقّ إلى قاعدة سفر موثقة"],
    scopeKey: scopeKey("research_context", ["live-search"]),
    checkedAt: research.checkedAt,
    validUntil: null,
    limitations: [...research.limitations],
  }));
}

function decisive(claim: AdvisorDecisionClaim): boolean {
  return (
    claim.authorityLevel >= 4 &&
    claim.evidenceStatus === "VERIFIED" &&
    (claim.polarity === "YES" || claim.polarity === "NO")
  );
}

export function resolveAdvisorClaimGroups(
  claims: AdvisorDecisionClaim[],
): AdvisorClaimGroup[] {
  const buckets = new Map<string, AdvisorDecisionClaim[]>();
  for (const claim of claims) {
    const key = claim.scopeKey;
    buckets.set(key, [...(buckets.get(key) ?? []), claim]);
  }

  return [...buckets.entries()].map(([key, groupClaims]) => {
    const first = groupClaims[0]!;
    const hasDeclaredConflict = groupClaims.some((claim) => claim.evidenceStatus === "CONFLICTED");
    const decisivePolarities = new Set(
      groupClaims.filter(decisive).map((claim) => claim.polarity),
    );
    const hasOpposingDecisions =
      decisivePolarities.has("YES") && decisivePolarities.has("NO");

    let resolution: AdvisorClaimResolution;
    let reason: string;
    if (hasDeclaredConflict || hasOpposingDecisions) {
      resolution = "CONFLICTED";
      reason = "هناك أدلة متعارضة ضمن نفس النطاق؛ صلة لا تختار مصدرًا بصمت.";
    } else if (groupClaims.some((claim) => claim.evidenceStatus === "VERIFIED")) {
      resolution = "SUPPORTED";
      reason = "يوجد دليل حالي مثبت ضمن النطاق المعروض.";
    } else if (groupClaims.some((claim) =>
      ["REPORTED", "UNCONFIRMED", "STALE", "EXPIRED"].includes(claim.evidenceStatus)
    )) {
      resolution = "UNCONFIRMED";
      reason = "توجد معلومة أو مصدر، لكن لا يكفي لإصدار حكم نهائي ضمن هذا النطاق.";
    } else {
      resolution = "UNKNOWN";
      reason = "لا توجد أدلة كافية قابلة للاعتماد ضمن النطاق الحالي.";
    }

    return {
      key,
      topic: first.topic,
      topicLabel: first.topicLabel,
      resolution,
      claimIds: groupClaims.map((claim) => claim.id),
      sourceCount: new Set(groupClaims.map((claim) => claim.sourceUrl || claim.sourceLabel)).size,
      reason,
    };
  });
}

function dynamicQuestions(
  input: TravelReadinessInput,
  groups: AdvisorClaimGroup[],
): AdvisorDecisionQuestion[] {
  const questions: AdvisorDecisionQuestion[] = [];
  const answers = input.advisorAnswers ?? {};
  const visa = groups.find((group) => group.topic === "entry_visa");
  const transit = groups.find((group) => group.topic === "transit");

  if (
    visa &&
    visa.resolution === "CONFLICTED" &&
    !input.travelDate &&
    !validTravelDate(answers.decision_travel_date)
  ) {
    questions.push({
      id: "decision_travel_date",
      label: "ما تاريخ السفر المتوقع؟ اكتب بصيغة YYYY-MM-DD",
      why: "بعض قواعد الدخول لها نطاق زمني؛ نحتاج تاريخًا صالحًا قبل مقارنة الأدلة المطبقة على رحلتك.",
      topic: "entry_visa",
      kind: "text",
      placeholder: "مثال: 2026-12-15",
    });
  }

  if (
    transit &&
    ["CONFLICTED", "UNKNOWN"].includes(transit.resolution) &&
    input.transitCountry
  ) {
    for (const question of missingTransitRouteQuestions(input)) {
      questions.push({
        ...question,
        topic: "transit_route",
      });
    }
  }

  return questions.slice(0, 6);
}

export function buildReadinessDecisionDossier(
  input: TravelReadinessInput,
  readiness: TravelReadinessResult,
  research: AdvisorLiveResearch,
  extraClaims: AdvisorDecisionClaim[] = [],
): AdvisorDecisionDossier {
  const claims = [
    ...readiness.checklist.map(checklistClaim),
    ...researchClaims(research),
    ...extraClaims,
  ];
  const groups = resolveAdvisorClaimGroups(claims);

  return {
    claims,
    groups,
    supported: groups
      .filter((group) => group.resolution === "SUPPORTED")
      .map((group) => group.topicLabel),
    unresolved: groups
      .filter((group) => ["UNCONFIRMED", "UNKNOWN"].includes(group.resolution))
      .map((group) => group.topicLabel),
    conflicts: groups
      .filter((group) => group.resolution === "CONFLICTED")
      .map((group) => group.topicLabel),
    followUpQuestions: dynamicQuestions(input, groups),
    generatedAt: readiness.evaluatedAt,
  };
}
