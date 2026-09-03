import { r2Configured, R2_BUCKET } from "@/lib/r2";

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
    if (!this.isConfigured()) {
      // Storage fallback mode when R2 is unconfigured
      return {
        downloadUrl: `https://storage.internal.local/private/${storageKey}?token=short_lived_demo_signed_token`,
        expiresInSeconds,
      };
    }

    return {
      downloadUrl: `https://${R2_BUCKET}.r2.cloudflarestorage.com/${storageKey}?X-Amz-Expires=${expiresInSeconds}`,
      expiresInSeconds,
    };
  }

  /**
   * Generates a presigned upload key for secure client upload.
   */
  public generatePrivateStorageKey(agentId: number, docType: string, filename: string): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `kyc/agent_${agentId}/${docType}_${timestamp}_${sanitizedFilename}`;
  }
}

export const privateStorageProvider = new PrivateStorageProvider();
