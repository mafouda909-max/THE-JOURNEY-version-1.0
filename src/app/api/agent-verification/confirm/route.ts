import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentDocuments, agents, auditLog } from "@/db/schema";
import { accountFromRequest, requireAccount } from "@/lib/identity";
import { privateObjectInfo } from "@/lib/b2";
import { validDocumentEvidence } from "@/lib/document-evidence";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["identity", "license", "commercial_register", "tax_id"]);
const TRUST_CRITICAL_TYPES = new Set(["identity", "license", "commercial_register"]);
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Backward-compatible confirmation endpoint. New web clients use
 * POST /api/agent-verification { action: "confirm" }, but this route enforces
 * the same fail-closed lifecycle for any older client.
 */
export async function POST(request: Request) {
  const account = await accountFromRequest(request);
  const denied = requireAccount(account, ["agent"]);
  if (denied) return denied;
  if (!account?.agentId) return NextResponse.json({ error: "حساب الوكيل غير مرتبط بملف وكيل." }, { status: 409 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات غير صالحة." }, { status: 400 }); }
  const documentId = Number((body as Record<string, unknown> | null)?.documentId);
  if (!Number.isInteger(documentId) || documentId <= 0) return NextResponse.json({ error: "معرّف المستند غير صالح." }, { status: 422 });

  const [agent, doc] = await Promise.all([
    db.select().from(agents).where(eq(agents.id, account.agentId)).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(agentDocuments).where(and(eq(agentDocuments.id, documentId), eq(agentDocuments.agentId, account.agentId!))).limit(1).then((rows) => rows[0] ?? null),
  ]);
  if (!agent) return NextResponse.json({ error: "ملف الوكيل غير موجود." }, { status: 404 });
  if (!doc) return NextResponse.json({ error: "المستند غير موجود لهذا الحساب." }, { status: 404 });
  if (!ALLOWED_TYPES.has(doc.documentType)) return NextResponse.json({ error: "نوع المستند غير مسموح." }, { status: 422 });
  if (doc.status === "pending") {
    return NextResponse.json({ ok: true, document: { id: doc.id, status: doc.status } });
  }
  if (doc.status !== "uploading") {
    return NextResponse.json({ error: "لا يمكن إعادة تأكيد مستند اتخذ فريق الثقة قرارًا بشأنه." }, { status: 409 });
  }

  const object = await privateObjectInfo(doc.storageKey);
  if (!object || !validDocumentEvidence(agent.id, doc, object)) {
    return NextResponse.json({ error: "لم يتم العثور على ملف صالح في التخزين الآمن." }, { status: 409 });
  }
  if (object.size <= 0 || object.size > MAX_BYTES) return NextResponse.json({ error: "الملف الموجود في التخزين غير صالح أو يتجاوز 10MB." }, { status: 422 });
  if (object.contentType && !ALLOWED_CONTENT_TYPES.has(object.contentType)) return NextResponse.json({ error: "نوع الملف المخزن غير مسموح." }, { status: 422 });

  const updated = await db.transaction(async (tx) => {
    const [confirmed] = await tx
      .update(agentDocuments)
      .set({ status: "pending" })
      .where(and(eq(agentDocuments.id, doc.id), eq(agentDocuments.status, "uploading")))
      .returning();
    if (!confirmed) return null;

    const shouldOpenReview = agent.verificationStatus === "pending";
    const shouldReReview = agent.verificationStatus === "verified" && TRUST_CRITICAL_TYPES.has(doc.documentType);
    if (shouldOpenReview || shouldReReview) {
      await tx
        .update(agents)
        .set({ verificationStatus: "in_review", ...(shouldReReview ? { verifiedAt: null } : {}) })
        .where(and(eq(agents.id, agent.id), eq(agents.verificationStatus, agent.verificationStatus)));
    }

    await tx.insert(auditLog).values({
      actor: `agent:${agent.id}`,
      action: "kyc_document_upload_confirmed",
      targetType: "agent",
      targetId: agent.id,
      reason: `Storage object confirmed for ${doc.documentType}: ${doc.originalName}`,
      meta: JSON.stringify({ documentId: doc.id, size: object.size, contentType: object.contentType }),
    });
    return confirmed;
  });

  if (!updated) return NextResponse.json({ error: "تغيّرت حالة المستند أثناء التأكيد. حدّث الصفحة وحاول مرة أخرى." }, { status: 409 });
  return NextResponse.json({ ok: true, document: { id: updated.id, status: updated.status, size: object.size, contentType: object.contentType } });
}
