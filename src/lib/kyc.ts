import { smsConfigured } from "@/lib/providers/sms";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { agentDocuments } from "@/db/schema";
import { privateStorageProvider } from "@/lib/storage";
import { inspectPrivateObject } from "@/lib/r2";
import { accountFromRequest } from "@/lib/identity";
import { isAdminRequest } from "@/lib/auth";
import { notify, accountIdForAgent } from "@/lib/notify";
export type DocumentType =
  | "commercial_register"
  | "license_cert"
  | "tax_id"
  | "passport_id"
  | "proof_address";
export const DOCUMENT_TYPES = [
  "commercial_register",
  "license_cert",
  "tax_id",
  "passport_id",
  "proof_address",
];
export class AgentKYCService {
  async submitDocument(params: {
    agentId: number;
    documentType: DocumentType;
    originalName: string;
    storageKey: string;
    request?: Request;
  }) {
    const account = params.request
      ? await accountFromRequest(params.request)
      : null;
    if (
      !account ||
      account.role !== "agent" ||
      account.agentId !== params.agentId
    )
      throw new Error("Forbidden");
    if (
      !DOCUMENT_TYPES.includes(params.documentType) ||
      !params.storageKey.startsWith(
        `kyc/agent_${params.agentId}/${params.documentType}/`,
      ) ||
      params.storageKey.includes("..")
    )
      throw new Error("Invalid document key");
    await inspectPrivateObject(params.storageKey);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        "SELECT verification_status FROM agents WHERE id=$1 FOR UPDATE",
        [params.agentId],
      );
      if (!["pending", "rejected"].includes(rows[0]?.verification_status))
        throw new Error(
          "Documents cannot change during review or after verification",
        );
      const existing = await client.query(
        "SELECT id FROM agent_documents WHERE storage_key=$1",
        [params.storageKey],
      );
      if (existing.rowCount) throw new Error("Document already submitted");
      const doc = await client.query(
        "INSERT INTO agent_documents(agent_id,document_type,original_name,storage_key,status) VALUES($1,$2,$3,$4,'pending') RETURNING *",
        [
          params.agentId,
          params.documentType,
          params.originalName.slice(0, 200),
          params.storageKey,
        ],
      );
      await client.query(
        "INSERT INTO audit_log(actor,action,target_type,target_id) VALUES($1,'kyc_document_submitted','agent',$2)",
        [`account:${account.id}`, params.agentId],
      );
      await client.query("COMMIT");
      return doc.rows[0];
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  async getAgentDocumentsWithAccess(agentId: number, request?: Request) {
    const account = request ? await accountFromRequest(request) : null;
    if (
      !request ||
      (!isAdminRequest(request) &&
        (account?.role !== "agent" || account.agentId !== agentId))
    )
      throw new Error("Forbidden");
    const docs = await db
      .select()
      .from(agentDocuments)
      .where(eq(agentDocuments.agentId, agentId));
    return Promise.all(
      docs.map(async (doc) => ({
        ...doc,
        signedAccessUrl: (
          await privateStorageProvider.getPresignedDownloadUrl(
            doc.storageKey,
            300,
          )
        ).downloadUrl,
      })),
    );
  }
  async reviewAgentKYC(params: {
    agentId: number;
    decision: "verified" | "rejected";
    reason?: string;
    request?: Request;
  }) {
    if (!params.request || !isAdminRequest(params.request))
      throw new Error("Forbidden");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        "SELECT * FROM agents WHERE id=$1 FOR UPDATE",
        [params.agentId],
      );
      const agent = rows[0];
      if (!agent || agent.verification_status !== "in_review")
        throw new Error("Agent must be submitted for review");
      if (params.decision === "verified") {
        const a = await client.query(
          "SELECT email_verified_at,phone_verified_at FROM accounts WHERE agent_id=$1",
          [params.agentId],
        );
        const docs = await client.query(
          "SELECT * FROM agent_documents WHERE agent_id=$1 AND status='verified' AND verified_at IS NOT NULL AND (expires_at IS NULL OR expires_at>now())",
          [params.agentId],
        );
        if (
          !a.rows[0]?.email_verified_at ||
          (smsConfigured() && !a.rows[0]?.phone_verified_at) ||
          !docs.rows.some((d) => d.document_type === "passport_id") ||
          (agent.license_type === "agency" &&
            !docs.rows.some((d) =>
              ["commercial_register", "license_cert"].includes(d.document_type),
            ))
        )
          throw new Error("Verified email and approved documents required");
        for (const doc of docs.rows)
          await inspectPrivateObject(doc.storage_key);
      } else if (!params.reason || params.reason.trim().length < 10)
        throw new Error("Reason required");
      await client.query(
        "UPDATE agents SET verification_status=$2::text,verified_at=CASE WHEN $2::text='verified' THEN now() ELSE NULL END WHERE id=$1",
        [params.agentId, params.decision],
      );
      await client.query(
        "INSERT INTO audit_log(actor,action,target_type,target_id,reason,prev_state,new_state) VALUES('admin',$1,'agent',$2,$3,'in_review',$4)",
        [
          `kyc_${params.decision}`,
          params.agentId,
          params.reason ?? null,
          params.decision,
        ],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    const accountId = await accountIdForAgent(params.agentId);
    if (accountId)
      await notify({
        accountId,
        type: `kyc_${params.decision}`,
        title: "تحديث مراجعة التوثيق",
        body:
          params.decision === "verified" ? "تم اعتماد توثيقك" : params.reason!,
        targetId: params.agentId,
        link: "/account",
      });
    return { ok: true, status: params.decision };
  }
}
export const agentKYCService = new AgentKYCService();
