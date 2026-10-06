import { createHash } from "node:crypto";
import type { ReadinessAdvisorResult } from "@/lib/readiness-advisor";
import type { AdvisorDecisionDossier } from "@/lib/readiness-decision-dossier";
import type {
  TravelReadinessInput,
  TravelReadinessResult,
} from "@/lib/travel-readiness";

export const SAVED_READINESS_KEY = "__silaReadiness";

export type SavedReadinessFreshness = "CURRENT" | "ATTENTION" | "UNKNOWN";
export type SavedReadinessChangeState = "FIRST_CHECK" | "UNCHANGED" | "CHANGED";

export interface SavedReadinessInputContext {
  nationality: string;
  passportValidityMonths: number;
  destination: string;
  transitCountry?: string;
  travelPurpose?: string;
  travelDate?: string;
  originCity?: string;
  travelerCount?: number;
  budgetAmount?: number;
  budgetCurrency?: string;
  advisorAnswers?: Record<string, string>;
}

export interface SavedReadinessDecisionState {
  status: TravelReadinessResult["status"];
  routeComplexity: ReadinessAdvisorResult["routeIntelligence"]["complexity"];
  groups: Array<{ key: string; topic: string; resolution: string }>;
  checklist: Array<{
    id: string;
    status: string;
    evidenceStatus: string;
    checkedAt: string | null;
    validUntil: string | null;
  }>;
  researchStatus: ReadinessAdvisorResult["liveResearch"]["status"];
  offerIds: number[];
}

export interface SavedReadinessState {
  version: 1;
  checkedAt: string;
  input: SavedReadinessInputContext;
  decision: SavedReadinessDecisionState;
  fingerprint: string;
  freshness: {
    status: SavedReadinessFreshness;
    nearestValidUntil: string | null;
    reasons: string[];
  };
  change: {
    state: SavedReadinessChangeState;
    previousCheckedAt: string | null;
    changedKeys: string[];
  };
}

export interface SavedReadinessPublicSummary {
  intentId: number;
  checkedAt: string;
  fingerprint: string;
  freshness: SavedReadinessState["freshness"];
  change: SavedReadinessState["change"];
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeIso(value: unknown): string | null {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function stableAnswers(value: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!value) return undefined;
  const entries = Object.entries(value)
    .filter(([key, answer]) => /^[a-z0-9_]{1,64}$/.test(key) && answer.trim().length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, answer]) => [key, answer.trim().replace(/\s+/g, " ").slice(0, 500)] as const);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function inputContext(input: TravelReadinessInput): SavedReadinessInputContext {
  return {
    nationality: input.nationality,
    passportValidityMonths: Number(input.passportValidityMonths ?? 0),
    destination: input.destination,
    ...(input.transitCountry ? { transitCountry: input.transitCountry } : {}),
    ...(input.travelPurpose ? { travelPurpose: input.travelPurpose } : {}),
    ...(input.travelDate ? { travelDate: input.travelDate } : {}),
    ...(input.originCity ? { originCity: input.originCity } : {}),
    ...(input.travelerCount !== undefined ? { travelerCount: input.travelerCount } : {}),
    ...(input.budgetAmount !== undefined ? { budgetAmount: input.budgetAmount } : {}),
    ...(input.budgetCurrency ? { budgetCurrency: input.budgetCurrency } : {}),
    ...(stableAnswers(input.advisorAnswers) ? { advisorAnswers: stableAnswers(input.advisorAnswers) } : {}),
  };
}

function decisionState(
  result: TravelReadinessResult,
  advisor: ReadinessAdvisorResult,
  dossier: AdvisorDecisionDossier,
): SavedReadinessDecisionState {
  return {
    status: result.status,
    routeComplexity: advisor.routeIntelligence.complexity,
    groups: dossier.groups
      .map((group) => ({
        key: group.key,
        topic: group.topic,
        resolution: group.resolution,
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    checklist: result.checklist
      .map((item) => ({
        id: item.id,
        status: item.status,
        evidenceStatus: item.evidence.status,
        checkedAt: item.evidence.checkedAt,
        validUntil: item.evidence.validUntil,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    researchStatus: advisor.liveResearch.status,
    offerIds: advisor.offers.map((offer) => offer.id).sort((a, b) => a - b),
  };
}

function fingerprint(input: SavedReadinessInputContext, decision: SavedReadinessDecisionState): string {
  const materialChecklist = decision.checklist.map(({ id, status, evidenceStatus }) => ({
    id,
    status,
    evidenceStatus,
  }));
  const material = {
    input,
    status: decision.status,
    routeComplexity: decision.routeComplexity,
    groups: decision.groups,
    checklist: materialChecklist,
    researchStatus: decision.researchStatus,
    offerIds: decision.offerIds,
  };
  return createHash("sha256").update(JSON.stringify(material)).digest("hex");
}

function freshness(
  result: TravelReadinessResult,
  dossier: AdvisorDecisionDossier,
): SavedReadinessState["freshness"] {
  const reasons: string[] = [];
  const evidence = result.checklist.map((item) => item.evidence);
  if (dossier.conflicts.length > 0) {
    reasons.push("يوجد تعارض في أدلة القرار.");
  }
  const attention = evidence.filter((item) =>
    ["STALE", "EXPIRED", "CONFLICTED"].includes(item.status),
  );
  if (attention.length > 0) {
    reasons.push("يوجد دليل قديم أو منتهي أو متعارض يحتاج إعادة تحقق.");
  }

  const validUntil = evidence
    .map((item) => safeIso(item.validUntil))
    .filter((value): value is string => Boolean(value))
    .sort();
  const nearestValidUntil = validUntil[0] ?? null;

  if (reasons.length > 0) {
    return { status: "ATTENTION", nearestValidUntil, reasons };
  }

  const verified = evidence.filter((item) => item.status === "VERIFIED");
  const allVerifiedHaveFreshness =
    verified.length > 0 &&
    verified.every((item) => safeIso(item.checkedAt) && safeIso(item.validUntil));

  if (allVerifiedHaveFreshness) {
    return {
      status: "CURRENT",
      nearestValidUntil,
      reasons: ["الأدلة المثبتة المحفوظة لها وقت فحص ونطاق صلاحية مسجل."],
    };
  }

  return {
    status: "UNKNOWN",
    nearestValidUntil,
    reasons: ["لا توجد صلاحية زمنية مكتملة لكل دليل حاسم؛ أعد التأكيد قبل الالتزام أو السفر."],
  };
}

function mapBy<T>(items: T[], key: (item: T) => string): Map<string, T> {
  return new Map(items.map((item) => [key(item), item]));
}

function changedKeys(
  previous: SavedReadinessState | null,
  current: SavedReadinessDecisionState,
): string[] {
  if (!previous) return [];

  const changed = new Set<string>();
  if (previous.decision.status !== current.status) changed.add("status");
  if (previous.decision.routeComplexity !== current.routeComplexity) changed.add("route");
  if (previous.decision.researchStatus !== current.researchStatus) changed.add("research");
  if (JSON.stringify(previous.decision.offerIds) !== JSON.stringify(current.offerIds)) changed.add("offers");

  const oldGroups = mapBy(previous.decision.groups, (item) => item.key);
  const newGroups = mapBy(current.groups, (item) => item.key);
  for (const key of new Set([...oldGroups.keys(), ...newGroups.keys()])) {
    const before = oldGroups.get(key);
    const after = newGroups.get(key);
    if (!before || !after || before.resolution !== after.resolution) {
      changed.add(`decision:${after?.topic ?? before?.topic ?? key}`);
    }
  }

  const oldChecklist = mapBy(previous.decision.checklist, (item) => item.id);
  const newChecklist = mapBy(current.checklist, (item) => item.id);
  for (const key of new Set([...oldChecklist.keys(), ...newChecklist.keys()])) {
    const before = oldChecklist.get(key);
    const after = newChecklist.get(key);
    if (
      !before ||
      !after ||
      before.status !== after.status ||
      before.evidenceStatus !== after.evidenceStatus
    ) {
      changed.add(`checklist:${key}`);
    }
  }

  return [...changed].sort();
}

function validFreshness(value: unknown): value is SavedReadinessFreshness {
  return ["CURRENT", "ATTENTION", "UNKNOWN"].includes(String(value));
}

function validChange(value: unknown): value is SavedReadinessChangeState {
  return ["FIRST_CHECK", "UNCHANGED", "CHANGED"].includes(String(value));
}

export function savedReadinessFromSnapshot(snapshot: unknown): SavedReadinessState | null {
  if (!record(snapshot) || !record(snapshot[SAVED_READINESS_KEY])) return null;
  const value = snapshot[SAVED_READINESS_KEY] as Record<string, unknown>;
  if (
    value.version !== 1 ||
    !safeIso(value.checkedAt) ||
    typeof value.fingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.fingerprint) ||
    !record(value.input) ||
    !record(value.decision) ||
    !record(value.freshness) ||
    !record(value.change)
  ) return null;

  const serialized = JSON.parse(JSON.stringify(value)) as SavedReadinessState;
  if (
    !validFreshness(serialized.freshness.status) ||
    !validChange(serialized.change.state) ||
    !Array.isArray(serialized.freshness.reasons) ||
    !serialized.freshness.reasons.every((reason) => typeof reason === "string") ||
    !Array.isArray(serialized.change.changedKeys) ||
    !serialized.change.changedKeys.every((key) => typeof key === "string") ||
    !Array.isArray(serialized.decision.groups) ||
    !Array.isArray(serialized.decision.checklist) ||
    !Array.isArray(serialized.decision.offerIds)
  ) return null;
  return serialized;
}

export function buildSavedReadinessState(
  previous: SavedReadinessState | null,
  input: TravelReadinessInput,
  result: TravelReadinessResult,
  advisor: ReadinessAdvisorResult,
  dossier: AdvisorDecisionDossier,
): SavedReadinessState {
  const storedInput = inputContext(input);
  const decision = decisionState(result, advisor, dossier);
  const nextFingerprint = fingerprint(storedInput, decision);
  const changed = changedKeys(previous, decision);
  const state: SavedReadinessChangeState = !previous
    ? "FIRST_CHECK"
    : previous.fingerprint === nextFingerprint
      ? "UNCHANGED"
      : "CHANGED";

  return {
    version: 1,
    checkedAt: result.evaluatedAt,
    input: storedInput,
    decision,
    fingerprint: nextFingerprint,
    freshness: freshness(result, dossier),
    change: {
      state,
      previousCheckedAt: previous?.checkedAt ?? null,
      changedKeys: state === "CHANGED" ? changed : [],
    },
  };
}

export function mergeSavedReadinessIntoSnapshot(
  snapshot: unknown,
  state: SavedReadinessState,
): Record<string, unknown> {
  const base = record(snapshot) ? { ...snapshot } : {};
  base[SAVED_READINESS_KEY] = state;
  return base;
}

export function publicSavedReadinessSummary(
  intentId: number,
  state: SavedReadinessState,
): SavedReadinessPublicSummary {
  return {
    intentId,
    checkedAt: state.checkedAt,
    fingerprint: state.fingerprint,
    freshness: state.freshness,
    change: state.change,
  };
}
