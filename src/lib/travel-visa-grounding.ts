import { evidenceSourceUrl, evidenceTimestamp, validTravelDate } from "./evidence";
export type GroundableVisaSource = "VERIFIED" | "SOURCE_REPORTED" | "AGENT_REPORTED" | "AI_INFERRED" | "UNKNOWN";

/** Conservative SILA recheck policy, not a claim about how long a law lasts. */
export const VISA_RECHECK_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export interface VisaScope {
  travelDocument: string;
  purpose: string;
  travelDates: "any" | { from: string; until: string };
}
export function visaScopeMatches(scope: unknown, query: { travelDocument: string; purpose?: string; travelDate?: string }): boolean {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) return false;
  const data = scope as Record<string, unknown>;
  if (data.travelDocument !== query.travelDocument ||
    (data.purpose !== "any" && (typeof data.purpose !== "string" || !query.purpose || data.purpose !== query.purpose))) return false;
  if (data.travelDates === "any") return true;
  if (!query.travelDate || !data.travelDates || typeof data.travelDates !== "object") return false;
  const dates = data.travelDates as Record<string, unknown>;
  return validTravelDate(query.travelDate) && validTravelDate(dates.from) && validTravelDate(dates.until) &&
    dates.from <= query.travelDate && query.travelDate <= dates.until;
}
export function visaFreshness(checkedAt: unknown, validUntil: unknown, declared: string, now = Date.now()): string {
  const checked = evidenceTimestamp(checkedAt), expiry = evidenceTimestamp(validUntil);
  if (validUntil != null && !expiry) return "UNKNOWN";
  if (expiry && Date.parse(expiry) <= now) return "EXPIRED";
  if (!checked || Date.parse(checked) > now + 300_000) return "UNKNOWN";
  if (now - Date.parse(checked) > VISA_RECHECK_MAX_AGE_MS) return "STALE";
  return ["FRESH","AGING","STALE","EXPIRED","CONFLICTED"].includes(declared) ? declared : "UNKNOWN";
}
export function groundedVisaDecision(input: {
  visaRequired: unknown; sourceType: GroundableVisaSource | string; freshnessStatus: string;
  decisionBasis?: unknown; checkedAt?: unknown; validUntil?: unknown; sourceUrl?: unknown; scope?: unknown;
  query?: { travelDocument: string; purpose?: string; travelDate?: string }; now?: number;
}): boolean | null {
  if (visaFreshness(input.checkedAt, input.validUntil, input.freshnessStatus, input.now) !== "FRESH") return null;
  if (!evidenceSourceUrl(input.sourceUrl) || !input.query || !visaScopeMatches(input.scope, input.query)) return null;
  if (input.sourceType !== "VERIFIED" && input.sourceType !== "SOURCE_REPORTED") return null;
  if (input.decisionBasis !== "structured_authoritative") return null;
  return typeof input.visaRequired === "boolean" ? input.visaRequired : null;
}
