import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { agents, agentDocuments, auditLog } from "@/db/schema";
import { privateStorageProvider } from "@/lib/storage";
import { notify, accountIdForAgent } from "@/lib/notify";

export type DocumentType =
  | "commercial_register"
  | "license_cert"
  | "tax_id"
  | "passport_id"
  | "proof_address";

export interface SubmitDocumentParams {
  agentId: number;
  documentType: DocumentType;
  originalName: string;
  storageKey: string;
}

export class AgentKYCService {
  /**
   * Register a submitted KYC/KYB document record for an agent.
   */
  public async submitDocument(params: SubmitDocumentParams) {
    const [doc] = await db
      .insert(agentDocuments)
      .values({
        agentId: params.agentId,
        documentType: params.documentType,
        originalName: params.originalName,
        storageKey: params.storageKey,
        status: "pending",
      })
      .returning();

    // Update agent status to in_review if currently pending
    await db
      .update(agents)
      .set({ verificationStatus: "in_review" })
      .where(and(eq(agents.id, params.agentId), eq(agents.verificationStatus, "pending")));

    await db.insert(auditLog).values({
      actor: "agent",
      action: "kyc_document_submitted",
      targetType: "agent",
      targetId: params.agentId,
      reason: `Uploaded ${params.documentType}: ${params.originalName}`,
    });

    return doc;
  }

  /**
   * Get all KYC documents for an agent with short-lived presigned URLs for authorized admin viewing.
   */
  public async getAgentDocumentsWithAccess(agentId: number) {
    const docs = await db
      .select()
      .from(agentDocuments)
      .where(eq(agentDocuments.agentId, agentId));

    const docsWithSignedUrls = await Promise.all(
      docs.map(async (doc) => {
        const signed = await privateStorageProvider.getPresignedDownloadUrl(doc.storageKey);
        return {
          ...doc,
          signedAccessUrl: signed.downloadUrl,
          expiresInSeconds: signed.expiresInSeconds,
        };
      }),
    );

    return docsWithSignedUrls;
  }

  /**
   * Admin verification decision on agent KYC.
   */
  public async reviewAgentKYC(params: {
    agentId: number;
    decision: "verified" | "rejected";
    reason?: string;
  }) {
    const newStatus = params.decision === "verified" ? "verified" : "rejected";
    const verifiedAt = params.decision === "verified" ? new Date() : null;

    await db
      .update(agents)
      .set({
        verificationStatus: newStatus,
        verifiedAt,
      })
      .where(eq(agents.id, params.agentId));

    await db.insert(auditLog).values({
      actor: "admin",
      action: `kyc_${params.decision}`,
      targetType: "agent",
      targetId: params.agentId,
      reason: params.reason || `KYC decision: ${params.decision}`,
      prevState: "in_review",
      newState: newStatus,
    });

    const accId = await accountIdForAgent(params.agentId);
    if (accId) {
      await notify({
        accountId: accId,
        type: "kyc_verification_update",
        title: params.decision === "verified" ? "تم توثيق الوكالة بنجاح" : "تم رفض طلب التوثيق",
        body:
          params.decision === "verified"
            ? "تهانينا! تم التحقق من وثائقك الرسمية وتفعيل شارة الوكيل المعتمد."
            : `تم مراجعة وثائق التوثيق: ${params.reason || "يرجى تعديل الوثائق وإعادة التقديم."}`,
        targetId: params.agentId,
      });
    }

    return { ok: true, status: newStatus };
  }
}

export const agentKYCService = new AgentKYCService();
