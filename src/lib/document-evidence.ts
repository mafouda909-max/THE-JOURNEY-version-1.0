export const DOCUMENT_TYPES = ["identity", "license", "commercial_register", "tax_id"] as const;
export const DOCUMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export function validDocumentEvidence(
  agentId: number,
  document: { documentType: string; storageKey: string; expiresAt?: Date | null },
  object: { size: number; contentType: string | null } | null,
): boolean {
  return Number.isSafeInteger(agentId) && agentId > 0 &&
    DOCUMENT_TYPES.some(type => type === document.documentType) &&
    document.storageKey.startsWith(`kyc/agent_${agentId}/${document.documentType}_`) &&
    !document.storageKey.includes("..") &&
    (!document.expiresAt || document.expiresAt > new Date()) &&
    !!object && Number.isSafeInteger(object.size) && object.size > 0 &&
    object.size <= MAX_DOCUMENT_BYTES && DOCUMENT_MIME_TYPES.includes(object.contentType ?? "");
}
