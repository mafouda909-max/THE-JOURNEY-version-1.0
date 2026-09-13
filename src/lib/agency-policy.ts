export const AGENCY_MEMBERSHIP_ROLES = ["owner", "member"] as const;
export type AgencyMembershipRole = (typeof AGENCY_MEMBERSHIP_ROLES)[number];

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function positiveAgencyId(value: string | number): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseWorkspaceCreateInput(value: unknown): ParseResult<Record<string, never>> {
  if (!isRecord(value)) return { ok: false, error: "Invalid workspace payload." };
  if (Object.keys(value).length !== 0) {
    return { ok: false, error: "Workspace identity is derived server-side; unexpected fields are not allowed." };
  }
  return { ok: true, value: {} };
}

export function parseMembershipCreateInput(
  value: unknown,
): ParseResult<{ accountId: number; role: "member" }> {
  if (!isRecord(value)) return { ok: false, error: "Invalid membership payload." };
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes("accountId") || !keys.includes("role")) {
    return { ok: false, error: "Only accountId and role are accepted." };
  }
  const accountId = positiveAgencyId(value.accountId as string | number);
  if (!accountId) return { ok: false, error: "accountId must be a positive integer." };
  if (value.role !== "member") {
    return { ok: false, error: "Phase 1 may only add workspace members; owner is assigned server-side." };
  }
  return { ok: true, value: { accountId, role: "member" } };
}

const SENSITIVE_EVENT_KEY = /(?:password|secret|token|cookie|authorization|api[_-]?key|email|phone)/i;

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > 4) return "[truncated]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, 240);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  if (!isRecord(value)) return undefined;

  const safe: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value).slice(0, 24)) {
    if (SENSITIVE_EVENT_KEY.test(key)) continue;
    const sanitized = sanitizeValue(item, depth + 1);
    if (sanitized !== undefined) safe[key.slice(0, 64)] = sanitized;
  }
  return safe;
}

export function sanitizeAgencyEventPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized = sanitizeValue(payload, 0);
  return isRecord(sanitized) ? sanitized : {};
}
