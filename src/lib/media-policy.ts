import { randomUUID } from "node:crypto";
export const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
export function mediaPrefix(
  agentId: number,
  resource: string,
  offerId?: number,
): string {
  if (!Number.isSafeInteger(agentId) || agentId < 1)
    throw new Error("Invalid owner");
  if (resource === "profile") return `media/agents/${agentId}/profile/`;
  if (resource === "offer" && Number.isSafeInteger(offerId) && offerId! > 0)
    return `media/agents/${agentId}/offers/${offerId}/`;
  throw new Error("Invalid resource");
}
export function uniqueObjectKey(prefix: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
  return `${prefix}${randomUUID()}-${safe}`;
}
