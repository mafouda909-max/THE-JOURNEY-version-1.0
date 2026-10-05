import type { TravelReadinessInput, TravelReadinessResult } from "./travel-readiness";
import { evidenceSourceUrl, validTravelDate } from "./evidence";

export interface ReadinessResponse extends TravelReadinessResult { disclosure: string }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string");
export function parseReadinessInput(value: unknown): TravelReadinessInput | null {
  if (!record(value)) return null;
  const required = (input: unknown) => typeof input === "string" && input.trim().length >= 2 && input.trim().length <= 64 ? input.trim() : null;
  const nationality = required(value.nationality), destination = required(value.destination);
  if (!nationality || !destination) return null;
  const months = value.passportValidityMonths;
  if (typeof months !== "number" && (typeof months !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(months))) return null;
  const passportValidityMonths = Number(months);
  if (!Number.isFinite(passportValidityMonths) || passportValidityMonths < 0 || passportValidityMonths > 120) return null;
  const optional = (input: unknown) => input === undefined || input === null || input === "" ? undefined : required(input);
  const transitCountry = optional(value.transitCountry), travelPurpose = optional(value.travelPurpose);
  if (transitCountry === null || travelPurpose === null) return null;
  const travelDate = value.travelDate === undefined || value.travelDate === null || value.travelDate === "" ? undefined : value.travelDate;
  if (travelDate !== undefined && !validTravelDate(travelDate)) return null;
  return { nationality, destination, passportValidityMonths, transitCountry, travelPurpose, travelDate };
}
export function isReadinessResponse(value: unknown): value is ReadinessResponse {
  if (!record(value) || !["READY","NEEDS_ATTENTION","NEEDS_CONFIRMATION","BLOCKED","UNKNOWN"].includes(String(value.status)) ||
    typeof value.overallScore !== "number" || !Number.isFinite(value.overallScore) || value.overallScore < 0 || value.overallScore > 100 ||
    typeof value.evaluatedAt !== "string" || !Number.isFinite(Date.parse(value.evaluatedAt)) || typeof value.disclosure !== "string" ||
    !strings(value.warnings) || !strings(value.missingInformation) || !record(value.decisionScope) || !strings(value.decisionScope.included) || !strings(value.decisionScope.excluded) || !Array.isArray(value.checklist) || value.checklist.length === 0) return false;
  if (value.status === "READY" && value.checklist.some(item => !record(item) || item.status !== "VERIFIED")) return false;
  return value.checklist.every(item => {
    if (!record(item) || !["id","title","category","description","nextAction"].every(key => typeof item[key] === "string") || typeof item.isMandatory !== "boolean" ||
      !["VERIFIED","PENDING_ACTION","PENDING_CONFIRMATION","BLOCKED","UNKNOWN"].includes(String(item.status)) || !record(item.evidence)) return false;
    const evidence = item.evidence;
    return ["travel_requirement","traveler_report"].includes(String(evidence.kind)) &&
      (evidence.linkedEntity === null || record(evidence.linkedEntity) && typeof evidence.linkedEntity.type === "string" && typeof evidence.linkedEntity.id === "string") &&
      record(evidence.source) && typeof evidence.source.label === "string" && typeof evidence.source.type === "string" &&
      (evidence.source.reference === null || !!evidenceSourceUrl(evidence.source.reference)) && strings(evidence.scope) && strings(evidence.limitations) &&
      ["VERIFIED","REPORTED","UNCONFIRMED","STALE","EXPIRED","CONFLICTED","UNKNOWN"].includes(String(evidence.status)) &&
      ["issuedAt","observedAt","checkedAt","verifiedAt","validUntil"].every(key => evidence[key] === null || typeof evidence[key] === "string" && Number.isFinite(Date.parse(evidence[key]))) &&
      (evidence.reviewer === null || typeof evidence.reviewer === "string");
  });
}
