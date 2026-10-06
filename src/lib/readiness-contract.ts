import type {
  ReadinessCurrency,
  TravelPurpose,
  TravelReadinessInput,
  TravelReadinessResult,
} from "./travel-readiness";
import type { ReadinessAdvisorResult } from "./readiness-advisor";
import type { AdvisorFollowUpQuestion } from "./readiness-advisor-policy";
import type { AdvisorDecisionDossier } from "./readiness-decision-dossier";
import { evidenceSourceUrl, validTravelDate } from "./evidence";
import {
  isValidStructuredTransitAnswer,
  type TransitRouteAssessment,
} from "./transit-route-intelligence";

export interface ReadinessResponse extends TravelReadinessResult {
  disclosure: string;
  advisor?: ReadinessAdvisorResult;
  decisionDossier?: AdvisorDecisionDossier;
}

export interface ReadinessQuestionsResponse {
  phase: "NEEDS_INPUT";
  questions: AdvisorFollowUpQuestion[];
}

const PURPOSES = new Set<TravelPurpose>([
  "tourism",
  "study",
  "work",
  "business",
  "freelance",
  "umrah",
  "visit",
  "medical",
  "transit",
  "other",
]);
const CURRENCIES = new Set<ReadinessCurrency>(["SAR", "AED", "USD", "EGP", "EUR"]);
const RESEARCH_STATUSES = new Set(["AVAILABLE", "SOURCES_ONLY", "NOT_CONFIGURED", "UNAVAILABLE"]);
const OFFER_STATUSES = new Set(["AVAILABLE", "NO_MATCH", "UNAVAILABLE"]);

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

function isFollowUpQuestion(value: unknown, includeTopic = false): boolean {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !/^[a-z0-9_]{1,64}$/.test(value.id) ||
    typeof value.label !== "string" ||
    value.label.length < 1 ||
    value.label.length > 240 ||
    typeof value.why !== "string" ||
    value.why.length < 1 ||
    value.why.length > 320 ||
    (value.kind !== undefined && !["text", "choice", "number"].includes(String(value.kind))) ||
    (value.placeholder !== undefined && (typeof value.placeholder !== "string" || value.placeholder.length > 160)) ||
    (includeTopic && typeof value.topic !== "string")
  ) return false;

  if (value.options !== undefined) {
    if (
      !Array.isArray(value.options) ||
      value.options.length < 2 ||
      value.options.length > 8 ||
      !value.options.every((option) =>
        record(option) &&
        typeof option.value === "string" &&
        /^[a-z0-9_:-]{1,64}$/.test(option.value) &&
        typeof option.label === "string" &&
        option.label.length > 0 &&
        option.label.length <= 120
      )
    ) return false;
  }
  if (value.kind === "choice" && !Array.isArray(value.options)) return false;
  if (value.kind !== "choice" && value.options !== undefined) return false;
  return true;
}

function isRouteIntelligence(value: unknown): value is TransitRouteAssessment {
  if (
    !record(value) ||
    !["NOT_APPLICABLE", "NEEDS_INPUT", "AVAILABLE"].includes(String(value.status)) ||
    !["LOW", "MEDIUM", "HIGH", "UNKNOWN"].includes(String(value.complexity)) ||
    typeof value.complexityLabel !== "string" ||
    typeof value.summary !== "string" ||
    !(value.routeDescription === null || typeof value.routeDescription === "string") ||
    !(
      value.layoverMinutes === null ||
      (typeof value.layoverMinutes === "number" &&
        Number.isInteger(value.layoverMinutes) &&
        value.layoverMinutes >= 1 &&
        value.layoverMinutes <= 1440)
    ) ||
    !Array.isArray(value.factors) ||
    value.factors.length > 4 ||
    !strings(value.limitations)
  ) return false;

  return value.factors.every((factor) =>
    record(factor) &&
    ["connection", "baggage", "airside", "layover"].includes(String(factor.id)) &&
    typeof factor.label === "string" &&
    ["LOWER_COMPLEXITY", "COMPLEXITY", "INFO", "UNKNOWN"].includes(String(factor.state)) &&
    typeof factor.detail === "string" &&
    typeof factor.nextAction === "string"
  );
}

function optionalText(
  value: unknown,
  min = 2,
  max = 64,
): string | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max ? trimmed : null;
}

function optionalNumber(
  value: unknown,
  input: { min: number; max: number; integer?: boolean },
): number | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value))
  ) return null;
  const parsed = Number(value);
  if (
    !Number.isFinite(parsed) ||
    parsed < input.min ||
    parsed > input.max ||
    (input.integer && !Number.isInteger(parsed))
  ) return null;
  return parsed;
}

export function parseReadinessInput(value: unknown): TravelReadinessInput | null {
  if (!record(value)) return null;
  const nationality = optionalText(value.nationality);
  const destination = optionalText(value.destination);
  if (!nationality || !destination) return null;

  const passportValidityMonths = optionalNumber(value.passportValidityMonths, {
    min: 0,
    max: 120,
  });
  if (passportValidityMonths === undefined || passportValidityMonths === null) return null;

  const transitCountry = optionalText(value.transitCountry);
  const originCity = optionalText(value.originCity);
  if (transitCountry === null || originCity === null) return null;

  let travelPurpose: TravelPurpose | undefined;
  if (value.travelPurpose !== undefined && value.travelPurpose !== null && value.travelPurpose !== "") {
    if (typeof value.travelPurpose !== "string" || !PURPOSES.has(value.travelPurpose as TravelPurpose)) {
      return null;
    }
    travelPurpose = value.travelPurpose as TravelPurpose;
  }

  const travelDate =
    value.travelDate === undefined || value.travelDate === null || value.travelDate === ""
      ? undefined
      : value.travelDate;
  if (travelDate !== undefined && !validTravelDate(travelDate)) return null;

  const travelerCount = optionalNumber(value.travelerCount, {
    min: 1,
    max: 50,
    integer: true,
  });
  if (travelerCount === null) return null;

  const budgetAmount = optionalNumber(value.budgetAmount, {
    min: 0,
    max: 10_000_000,
  });
  if (budgetAmount === null) return null;

  let budgetCurrency: ReadinessCurrency | undefined;
  if (value.budgetCurrency !== undefined && value.budgetCurrency !== null && value.budgetCurrency !== "") {
    if (typeof value.budgetCurrency !== "string" || !CURRENCIES.has(value.budgetCurrency as ReadinessCurrency)) {
      return null;
    }
    budgetCurrency = value.budgetCurrency as ReadinessCurrency;
  }
  if ((budgetAmount === undefined) !== (budgetCurrency === undefined)) return null;

  let advisorAnswers: Record<string, string> | undefined;
  if (value.advisorAnswers !== undefined && value.advisorAnswers !== null) {
    if (!record(value.advisorAnswers)) return null;
    const entries = Object.entries(value.advisorAnswers);
    if (entries.length > 12) return null;
    const cleaned: Record<string, string> = {};
    for (const [key, answer] of entries) {
      if (!/^[a-z0-9_]{1,64}$/.test(key) || typeof answer !== "string") return null;
      const text = answer.trim().replace(/\s+/g, " ");
      if (!text || text.length > 500) return null;
      if (!isValidStructuredTransitAnswer(key, text)) return null;
      cleaned[key] = text;
    }
    if (Object.keys(cleaned).length > 0) advisorAnswers = cleaned;
  }

  return {
    nationality,
    destination,
    passportValidityMonths,
    ...(transitCountry ? { transitCountry } : {}),
    ...(travelPurpose ? { travelPurpose } : {}),
    ...(travelDate ? { travelDate } : {}),
    ...(originCity ? { originCity } : {}),
    ...(travelerCount !== undefined ? { travelerCount } : {}),
    ...(budgetAmount !== undefined ? { budgetAmount } : {}),
    ...(budgetCurrency ? { budgetCurrency } : {}),
    ...(advisorAnswers ? { advisorAnswers } : {}),
  };
}

function isDecisionDossier(value: unknown): value is AdvisorDecisionDossier {
  if (
    !record(value) ||
    !Array.isArray(value.claims) ||
    value.claims.length > 50 ||
    !Array.isArray(value.groups) ||
    value.groups.length > 30 ||
    !strings(value.supported) ||
    !strings(value.unresolved) ||
    !strings(value.conflicts) ||
    !Array.isArray(value.followUpQuestions) ||
    value.followUpQuestions.length > 6 ||
    typeof value.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.generatedAt))
  ) return false;

  const claimsOk = value.claims.every((claim) =>
    record(claim) &&
    typeof claim.id === "string" &&
    typeof claim.topic === "string" &&
    typeof claim.topicLabel === "string" &&
    typeof claim.statement === "string" &&
    ["YES", "NO", "UNKNOWN", "NEUTRAL"].includes(String(claim.polarity)) &&
    typeof claim.sourceType === "string" &&
    typeof claim.sourceLabel === "string" &&
    (claim.sourceUrl === null || (typeof claim.sourceUrl === "string" && !!evidenceSourceUrl(claim.sourceUrl))) &&
    typeof claim.authorityLevel === "number" &&
    Number.isInteger(claim.authorityLevel) &&
    claim.authorityLevel >= 0 &&
    claim.authorityLevel <= 5 &&
    ["VERIFIED", "REPORTED", "UNCONFIRMED", "STALE", "EXPIRED", "CONFLICTED", "UNKNOWN"].includes(String(claim.evidenceStatus)) &&
    strings(claim.scope) &&
    typeof claim.scopeKey === "string" &&
    (claim.checkedAt === null || (typeof claim.checkedAt === "string" && Number.isFinite(Date.parse(claim.checkedAt)))) &&
    (claim.validUntil === null || (typeof claim.validUntil === "string" && Number.isFinite(Date.parse(claim.validUntil)))) &&
    strings(claim.limitations)
  );

  const groupsOk = value.groups.every((group) =>
    record(group) &&
    typeof group.key === "string" &&
    typeof group.topic === "string" &&
    typeof group.topicLabel === "string" &&
    ["SUPPORTED", "UNCONFIRMED", "CONFLICTED", "UNKNOWN"].includes(String(group.resolution)) &&
    strings(group.claimIds) &&
    typeof group.sourceCount === "number" &&
    Number.isInteger(group.sourceCount) &&
    group.sourceCount >= 0 &&
    typeof group.reason === "string"
  );

  const questionsOk = value.followUpQuestions.every((question) =>
    isFollowUpQuestion(question, true)
  );

  return claimsOk && groupsOk && questionsOk;
}

function isAdvisor(value: unknown): value is ReadinessAdvisorResult {
  if (!record(value)) return false;
  if (
    value.purpose !== null &&
    (typeof value.purpose !== "string" || !PURPOSES.has(value.purpose as TravelPurpose))
  ) return false;
  if (
    typeof value.purposeLabel !== "string" ||
    !strings(value.questionsToComplete) ||
    !strings(value.preparationTopics) ||
    !strings(value.limitations) ||
    !OFFER_STATUSES.has(String(value.offerSearchStatus)) ||
    !record(value.liveResearch) ||
    !isRouteIntelligence(value.routeIntelligence) ||
    !Array.isArray(value.offers)
  ) return false;

  const research = value.liveResearch;
  if (
    !RESEARCH_STATUSES.has(String(research.status)) ||
    !(research.answer === null || typeof research.answer === "string") ||
    !(
      research.confidence === null ||
      ["HIGH", "MEDIUM", "LOW"].includes(String(research.confidence))
    ) ||
    typeof research.checkedAt !== "string" ||
    !Number.isFinite(Date.parse(research.checkedAt)) ||
    !strings(research.limitations) ||
    !Array.isArray(research.sources)
  ) return false;

  if (!research.sources.every((source) =>
    record(source) &&
    typeof source.title === "string" &&
    typeof source.url === "string" &&
    !!evidenceSourceUrl(source.url) &&
    source.sourceType === "SOURCE_REPORTED"
  )) return false;

  return value.offers.every((offer) =>
    record(offer) &&
    typeof offer.id === "number" &&
    Number.isSafeInteger(offer.id) &&
    offer.id > 0 &&
    typeof offer.title === "string" &&
    typeof offer.href === "string" &&
    /^\/offers\/\d+$/.test(offer.href) &&
    typeof offer.destination === "string" &&
    typeof offer.priceAmount === "number" &&
    Number.isFinite(offer.priceAmount) &&
    typeof offer.currency === "string" &&
    typeof offer.priceType === "string" &&
    typeof offer.agentName === "string" &&
    strings(offer.matchReasons) &&
    strings(offer.confirmationNeeded)
  );
}

export function isReadinessResponse(value: unknown): value is ReadinessResponse {
  if (
    !record(value) ||
    !["READY", "NEEDS_ATTENTION", "NEEDS_CONFIRMATION", "BLOCKED", "UNKNOWN"].includes(String(value.status)) ||
    typeof value.overallScore !== "number" ||
    !Number.isFinite(value.overallScore) ||
    value.overallScore < 0 ||
    value.overallScore > 100 ||
    typeof value.evaluatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.evaluatedAt)) ||
    typeof value.disclosure !== "string" ||
    !strings(value.warnings) ||
    !strings(value.missingInformation) ||
    !record(value.decisionScope) ||
    !strings(value.decisionScope.included) ||
    !strings(value.decisionScope.excluded) ||
    !Array.isArray(value.checklist) ||
    value.checklist.length === 0 ||
    (value.advisor !== undefined && !isAdvisor(value.advisor)) ||
    (value.decisionDossier !== undefined && !isDecisionDossier(value.decisionDossier))
  ) return false;

  if (
    value.status === "READY" &&
    value.checklist.some((item) => !record(item) || item.status !== "VERIFIED")
  ) return false;

  return value.checklist.every((item) => {
    if (
      !record(item) ||
      !["id", "title", "category", "description", "nextAction"].every(
        (key) => typeof item[key] === "string",
      ) ||
      typeof item.isMandatory !== "boolean" ||
      !["VERIFIED", "PENDING_ACTION", "PENDING_CONFIRMATION", "BLOCKED", "UNKNOWN"].includes(String(item.status)) ||
      !record(item.evidence)
    ) return false;
    const evidence = item.evidence;
    return (
      ["travel_requirement", "traveler_report"].includes(String(evidence.kind)) &&
      (
        evidence.linkedEntity === null ||
        (record(evidence.linkedEntity) &&
          typeof evidence.linkedEntity.type === "string" &&
          typeof evidence.linkedEntity.id === "string")
      ) &&
      record(evidence.source) &&
      typeof evidence.source.label === "string" &&
      typeof evidence.source.type === "string" &&
      (evidence.source.reference === null || !!evidenceSourceUrl(evidence.source.reference)) &&
      strings(evidence.scope) &&
      strings(evidence.limitations) &&
      ["VERIFIED", "REPORTED", "UNCONFIRMED", "STALE", "EXPIRED", "CONFLICTED", "UNKNOWN"].includes(String(evidence.status)) &&
      ["issuedAt", "observedAt", "checkedAt", "verifiedAt", "validUntil"].every(
        (key) =>
          evidence[key] === null ||
          (typeof evidence[key] === "string" && Number.isFinite(Date.parse(evidence[key] as string))),
      ) &&
      (evidence.reviewer === null || typeof evidence.reviewer === "string")
    );
  });
}


export function isReadinessQuestionsResponse(value: unknown): value is ReadinessQuestionsResponse {
  if (!record(value) || value.phase !== "NEEDS_INPUT" || !Array.isArray(value.questions)) return false;
  return (
    value.questions.length > 0 &&
    value.questions.length <= 8 &&
    value.questions.every((question) => isFollowUpQuestion(question))
  );
}
