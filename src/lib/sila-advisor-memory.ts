import {
  parseSilaTravelCase,
  serializeSilaTravelCase,
  type SilaTravelCaseSnapshot,
} from "./sila-advisor-travel-case";

export const SILA_ADVISOR_CASE_KEY = "__silaAdvisorCase";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function silaAdvisorCaseFromSnapshot(snapshot: unknown): SilaTravelCaseSnapshot | null {
  const base = record(snapshot);
  if (!base) return null;
  const stored = base[SILA_ADVISOR_CASE_KEY];
  if (!stored) return null;
  const serialized = typeof stored === "string" ? stored : JSON.stringify(stored);
  return parseSilaTravelCase(serialized);
}

export function mergeSilaAdvisorCaseIntoSnapshot(
  snapshot: unknown,
  travelCase: SilaTravelCaseSnapshot,
): Record<string, unknown> {
  const base = record(snapshot) ? { ...(snapshot as Record<string, unknown>) } : {};
  base[SILA_ADVISOR_CASE_KEY] = JSON.parse(serializeSilaTravelCase(travelCase)) as unknown;
  return base;
}

export function removeSilaAdvisorCaseFromSnapshot(snapshot: unknown): Record<string, unknown> {
  const base = record(snapshot) ? { ...(snapshot as Record<string, unknown>) } : {};
  delete base[SILA_ADVISOR_CASE_KEY];
  return base;
}
