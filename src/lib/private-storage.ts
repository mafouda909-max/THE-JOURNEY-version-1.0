import { b2Configured, createPrivateDownloadUrl, createPrivateUploadUrl } from "@/lib/b2";

export interface PresignedUploadResult { uploadUrl: string; storageKey: string; expiresInSeconds: number; }
export interface PresignedDownloadResult { downloadUrl: string; expiresInSeconds: number; }

/** Private KYC/KYB document storage backed by a private Backblaze B2 bucket. */
export class PrivateStorageProvider {
  public isConfigured(): boolean { return b2Configured; }

  public async getPresignedDownloadUrl(storageKey: string, expiresInSeconds = 900): Promise<PresignedDownloadResult> {
    if (!this.isConfigured()) throw new Error("Backblaze B2 private storage is not configured");
    return createPrivateDownloadUrl(storageKey, expiresInSeconds);
  }

  public async getPresignedUploadUrl(storageKey: string, contentType: string, contentLength?: number): Promise<PresignedUploadResult> {
    if (!this.isConfigured()) throw new Error("Backblaze B2 private storage is not configured");
    return createPrivateUploadUrl(storageKey, contentType, contentLength);
  }

  public generatePrivateStorageKey(agentId: number, docType: string, filename: string): string {
    const timestamp = crypto.randomUUID();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, "_");
    return `kyc/agent_${agentId}/${docType}_${timestamp}_${sanitizedFilename}`;
  }
}

export const privateStorageProvider = new PrivateStorageProvider();
