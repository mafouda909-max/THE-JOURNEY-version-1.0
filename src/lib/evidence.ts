/** Read projection only. Ownership and foreign keys remain in their modules. */
export interface Evidence {
  kind: "travel_requirement" | "traveler_report";
  linkedEntity: { type: string; id: string } | null;
  source: { type: string; label: string; reference: string | null };
  issuedAt: string | null;
  observedAt: string | null;
  checkedAt: string | null;
  verifiedAt: string | null;
  validUntil: string | null;
  scope: string[];
  status: "VERIFIED" | "REPORTED" | "UNCONFIRMED" | "STALE" | "EXPIRED" | "CONFLICTED" | "UNKNOWN";
  reviewer: string | null;
  limitations: string[];
}
export function evidenceTimestamp(value: unknown): string | null {
  if (!(value instanceof Date) && typeof value !== "string") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
export function evidenceSourceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password ||
      [...url.searchParams.keys()].some(key => /^(?:token|access_token|api_key|apikey|signature|x-amz-signature)$/i.test(key))) return null;
    return url.href;
  } catch { return null; }
}
export function validTravelDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
