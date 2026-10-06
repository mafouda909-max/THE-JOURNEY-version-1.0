import {
  savedReadinessFromSnapshot,
  type SavedReadinessState,
} from "@/lib/traveler-readiness-memory";
import {
  travelPreparationDefinition,
  type TravelDossierCategory,
  type TravelDossierReadinessState,
  type TravelDossierRequirementState,
} from "@/lib/travel-preparation-dossier";
import type { TravelPurpose } from "@/lib/travel-readiness";

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

const DECISION_STATUSES = new Set([
  "READY",
  "NEEDS_ATTENTION",
  "NEEDS_CONFIRMATION",
  "BLOCKED",
  "UNKNOWN",
]);

const ROUTE_COMPLEXITIES = new Set(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]);
const GROUP_RESOLUTIONS = new Set(["SUPPORTED", "UNCONFIRMED", "CONFLICTED", "UNKNOWN"]);
const REQUIREMENT_STATES = new Set<TravelDossierRequirementState>([
  "CONFIRMED_REQUIRED",
  "CONFIRMED_NOT_REQUIRED",
  "TO_VERIFY",
  "PLANNING_ONLY",
]);
const READINESS_STATES = new Set<TravelDossierReadinessState>([
  "REPORTED_READY",
  "NEEDS_ACTION",
  "NEEDS_TRAVELER_CONFIRMATION",
  "UNKNOWN",
  "NOT_APPLICABLE",
]);

export interface AgencyClientTravelBriefItem {
  id: string;
  category: TravelDossierCategory;
  title: string;
  requirementState: TravelDossierRequirementState;
  readinessState: TravelDossierReadinessState;
  nextAction: string;
}

export interface AgencyClientTravelBrief {
  source: "linked_saved_trip";
  checkedAt: string;
  trip: {
    nationality: string;
    passportValidityMonths: number;
    destination: string;
    purpose: TravelPurpose | null;
    travelDate: string | null;
    transitCountry: string | null;
  };
  decision: {
    status: SavedReadinessState["decision"]["status"];
    routeComplexity: SavedReadinessState["decision"]["routeComplexity"];
    topics: Array<{
      topic: string;
      resolution: "SUPPORTED" | "UNCONFIRMED" | "CONFLICTED" | "UNKNOWN";
    }>;
  };
  freshness: SavedReadinessState["freshness"];
  change: {
    state: SavedReadinessState["change"]["state"];
    previousCheckedAt: string | null;
    changedKeys: string[];
  };
  preparation: AgencyClientTravelBriefItem[];
  disclosure: string;
}

function safeText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length > 0 && cleaned.length <= max ? cleaned : null;
}

function safeIso(value: unknown): string | null {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function validPurpose(value: unknown): TravelPurpose | null {
  return typeof value === "string" && PURPOSES.has(value as TravelPurpose)
    ? value as TravelPurpose
    : null;
}

function projectPreparation(
  saved: SavedReadinessState,
  purpose: TravelPurpose | null,
): AgencyClientTravelBriefItem[] | null {
  if (!Array.isArray(saved.decision.preparation) || saved.decision.preparation.length > 30) return null;
  const projected: AgencyClientTravelBriefItem[] = [];
  for (const item of saved.decision.preparation) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      !/^[a-z0-9_]{1,64}$/.test(item.id) ||
      !REQUIREMENT_STATES.has(item.requirementState as TravelDossierRequirementState) ||
      !READINESS_STATES.has(item.readinessState as TravelDossierReadinessState)
    ) return null;
    const definition = travelPreparationDefinition(purpose, item.id);
    if (!definition) return null;
    projected.push({
      id: item.id,
      category: definition.category,
      title: definition.title,
      requirementState: item.requirementState as TravelDossierRequirementState,
      readinessState: item.readinessState as TravelDossierReadinessState,
      nextAction: definition.nextAction,
    });
  }
  return projected;
}

export function projectAgencyClientTravelBrief(
  snapshot: unknown,
  now: Date = new Date(),
): AgencyClientTravelBrief | null {
  const saved = savedReadinessFromSnapshot(snapshot, now);
  if (!saved) return null;

  const nationality = safeText(saved.input.nationality, 64);
  const destination = safeText(saved.input.destination, 64);
  const passportValidityMonths = Number(saved.input.passportValidityMonths);
  const purpose = validPurpose(saved.input.travelPurpose);
  const travelDate = saved.input.travelDate ? safeIso(saved.input.travelDate) : null;
  const transitCountry = saved.input.transitCountry
    ? safeText(saved.input.transitCountry, 64)
    : null;

  if (
    !nationality ||
    !destination ||
    !Number.isInteger(passportValidityMonths) ||
    passportValidityMonths < 0 ||
    passportValidityMonths > 240 ||
    !DECISION_STATUSES.has(String(saved.decision.status)) ||
    !ROUTE_COMPLEXITIES.has(String(saved.decision.routeComplexity))
  ) return null;

  const topics: AgencyClientTravelBrief["decision"]["topics"] = [];
  if (!Array.isArray(saved.decision.groups) || saved.decision.groups.length > 30) return null;
  for (const group of saved.decision.groups) {
    const topic = safeText(group?.topic, 64);
    if (!topic || !GROUP_RESOLUTIONS.has(String(group?.resolution))) return null;
    topics.push({
      topic,
      resolution: group.resolution as AgencyClientTravelBrief["decision"]["topics"][number]["resolution"],
    });
  }

  const preparation = projectPreparation(saved, purpose);
  if (!preparation) return null;

  const changedKeys = saved.change.changedKeys
    .filter((key) =>
      /^(status|route|offers|decision:[a-z0-9_:-]{1,80}|checklist:[a-z0-9_:-]{1,80}|preparation:[a-z0-9_:-]{1,80})$/.test(key)
    )
    .slice(0, 50);

  return {
    source: "linked_saved_trip",
    checkedAt: saved.checkedAt,
    trip: {
      nationality,
      passportValidityMonths,
      destination,
      purpose,
      travelDate,
      transitCountry,
    },
    decision: {
      status: saved.decision.status,
      routeComplexity: saved.decision.routeComplexity,
      topics,
    },
    freshness: {
      status: saved.freshness.status,
      nearestValidUntil: saved.freshness.nearestValidUntil,
      reasons: saved.freshness.reasons.slice(0, 10),
    },
    change: {
      state: saved.change.state,
      previousCheckedAt: saved.change.previousCheckedAt,
      changedKeys,
    },
    preparation,
    disclosure:
      "هذا ملخص قرار مشتق من رحلة ربطها المسافر بالاستفسار. لا يعرض إجابات المستشار الخام، ولا يحوّل بيانات المسافر أو خطة التجهيز إلى دليل رسمي.",
  };
}
