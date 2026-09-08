import { r2Configured, privateDownloadUrl } from "@/lib/r2";
import { uniqueObjectKey } from "@/lib/media-policy";

/**
 * PRIVATE DOCUMENT STORAGE PROVIDER ABSTRACTION
 *
 * Security Guarantee: KYC/KYB documents are strictly private.
 * No public URLs are ever exposed. All access requires short-lived presigned URLs.
 */

export interface PresignedUploadResult {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

export interface PresignedDownloadResult {
  downloadUrl: string;
  expiresInSeconds: number;
}

export class PrivateStorageProvider {
  public isConfigured(): boolean {
    return r2Configured;
  }

  /**
   * Generates a short-lived presigned URL for private document access.
   */
  public async getPresignedDownloadUrl(
    storageKey: string,
    expiresInSeconds = 900, // 15 minutes default
  ): Promise<PresignedDownloadResult> {
    return {
      downloadUrl: await privateDownloadUrl(storageKey, expiresInSeconds),
      expiresInSeconds,
    };
  }

  /**
   * Generates a presigned upload key for secure client upload.
   */
  public generatePrivateStorageKey(
    agentId: number,
    docType: string,
    filename: string,
  ): string {
    if (
      !Number.isSafeInteger(agentId) ||
      agentId < 1 ||
      !/^[a-z_]+$/.test(docType)
    )
      throw new Error("Invalid private resource");
    return uniqueObjectKey(`kyc/agent_${agentId}/${docType}/`, filename);
  }
}

export const privateStorageProvider = new PrivateStorageProvider();
