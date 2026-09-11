import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, agentDocuments, auditLog } from "@/db/schema";
import { accountFromRequest, requireAccount } from "@/lib/identity";
import { privateStorageProvider } from "@/lib/private-storage";
import { validDocumentEvidence } from "@/lib/document-evidence";
import { privateObjectInfo } from "@/lib/b2";

export const dynamic = "force-dynamic";

const DOCUMENT_RULES = {
  identity: { maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "application/pdf"] },
  license: { maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "application/pdf"] },
  commercial_register: { maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "application/pdf"] },
  tax_id: { maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "application/pdf"] },
} as const;

const TRUST_CRITICAL_DOCUMENTS = new Set(["identity", "license", "commercial_register"]);

type DocumentType = keyof typeof DOCUMENT_RULES;
function clean(value: unknown, max = 500): string { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

async function getOwnedAgent(request: Request) {
  const account = await accountFromRequest(request);
  const denied = requireAccount(account, ["agent"]);
  if (denied) return { denied };
  if (!account?.agentId) return { denied: NextResponse.json({ error: "حساب الوكيل غير مرتبط بملف وكيل." }, { status: 409 }) };
  const rows = await db.select().from(agents).where(eq(agents.id, account.agentId)).limit(1);
  if (!rows[0]) return { denied: NextResponse.json({ error: "ملف الوكيل غير موجود." }, { status: 404 }) };
  return { account, agent: rows[0] };
}

export async function GET(request: Request) {
  const result = await getOwnedAgent(request);
  if (result.denied) return result.denied;
  const docs = await db.select({ id: agentDocuments.id, documentType: agentDocuments.documentType, originalName: agentDocuments.originalName, status: agentDocuments.status, rejectionReason: agentDocuments.rejectionReason, expiresAt: agentDocuments.expiresAt, createdAt: agentDocuments.createdAt }).from(agentDocuments).where(eq(agentDocuments.agentId, result.agent!.id));
  return NextResponse.json({ accountEmail: result.account!.email, agent: { id: result.agent!.id, displayName: result.agent!.displayName, latinName: result.agent!.latinName, bio: result.agent!.bio, city: result.agent!.city, country: result.agent!.country, licenseType: result.agent!.licenseType, licenseNumber: result.agent!.licenseNumber, verificationStatus: result.agent!.verificationStatus }, documents: docs });
}

export async function PATCH(request: Request) {
  const result = await getOwnedAgent(request);
  if (result.denied) return result.denied;
  const current = result.agent!;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات غير صالحة." }, { status: 400 }); }
  const data = (body ?? {}) as Record<string, unknown>;
  const displayName = clean(data.displayName, 120), latinName = clean(data.latinName, 120), bio = clean(data.bio, 1200), city = clean(data.city, 120), country = clean(data.country, 120);
  const licenseType = data.licenseType === "agency" ? "agency" : "individual";
  const licenseNumber = clean(data.licenseNumber, 40);
  if (!displayName || !latinName || !bio || !city || !country) return NextResponse.json({ error: "أكمل الاسم، الاسم اللاتيني، النبذة، الدولة والمدينة." }, { status: 422 });
  if (bio.length < 30) return NextResponse.json({ error: "النبذة المهنية يجب أن تكون ٣٠ حرفاً على الأقل." }, { status: 422 });
  if (licenseType === "agency" && !licenseNumber) return NextResponse.json({ error: "رقم الترخيص مطلوب للحساب المؤسسي." }, { status: 422 });

  const normalizedLicense = licenseNumber || null;
  const trustCriticalChanged =
    displayName !== current.displayName ||
    latinName !== current.latinName ||
    city !== current.city ||
    country !== current.country ||
    licenseType !== current.licenseType ||
    normalizedLicense !== current.licenseNumber;
  const requiresReReview = current.verificationStatus === "verified" && trustCriticalChanged;
  const nextStatus = requiresReReview ? "in_review" : current.verificationStatus;

  const [updated] = await db.update(agents).set({
    displayName,
    latinName,
    bio,
    city,
    country,
    licenseType,
    licenseNumber: normalizedLicense,
    ...(requiresReReview ? { verificationStatus: "in_review", verifiedAt: null } : {}),
  }).where(and(eq(agents.id, current.id), eq(agents.verificationStatus, current.verificationStatus))).returning();

  if (!updated) {
    return NextResponse.json({ error: "تغيّرت حالة ملفك أثناء الحفظ. حدّث الصفحة وحاول مرة أخرى." }, { status: 409 });
  }

  await db.insert(auditLog).values({
    actor: `agent:${current.id}`,
    action: requiresReReview ? "agent_profile_changed_reverification_required" : "agent_profile_updated",
    targetType: "agent",
    targetId: updated.id,
    reason: requiresReReview
      ? "Verification-sensitive identity or licensing fields changed after approval"
      : "Verification profile updated",
    prevState: current.verificationStatus,
    newState: nextStatus,
  });

  return NextResponse.json({
    agent: updated,
    reverificationRequired: requiresReReview,
    message: requiresReReview
      ? "حُفظت التغييرات. لأن بيانات الهوية أو الترخيص تغيّرت، عاد الملف للمراجعة قبل ظهور شارة التوثيق مجددًا."
      : "تم حفظ بيانات الملف.",
  });
}

export async function POST(request: Request) {
  const result = await getOwnedAgent(request);
  if (result.denied) return result.denied;
  const agent = result.agent!;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات غير صالحة." }, { status: 400 }); }
  const data = (body ?? {}) as Record<string, unknown>;

  if (data.action === "confirm") {
    const documentId = Number(data.documentId);
    if (!Number.isInteger(documentId) || documentId <= 0) return NextResponse.json({ error: "معرّف المستند غير صالح." }, { status: 422 });
    const rows = await db.select().from(agentDocuments).where(and(eq(agentDocuments.id, documentId), eq(agentDocuments.agentId, agent.id))).limit(1);
    const doc = rows[0];
    if (!doc) return NextResponse.json({ error: "المستند غير موجود." }, { status: 404 });
    if (!Object.hasOwn(DOCUMENT_RULES, doc.documentType)) return NextResponse.json({ error: "نوع المستند غير مسموح." }, { status: 422 });
    if (doc.status === "pending") {
      return NextResponse.json({ ok: true, stored: true, document: { id: doc.id, documentType: doc.documentType, originalName: doc.originalName, status: doc.status, stored: true } });
    }
    if (doc.status !== "uploading") {
      return NextResponse.json({ error: "لا يمكن إعادة تأكيد مستند اتخذ فريق الثقة قرارًا بشأنه." }, { status: 409 });
    }

    const rule = DOCUMENT_RULES[doc.documentType as DocumentType];
    const object = await privateObjectInfo(doc.storageKey);
    if (!validDocumentEvidence(agent.id, doc, object)) return NextResponse.json({ error: "الملف المخزن لا يطابق أدلة التوثيق المطلوبة." }, { status: 422 });
    if (!object) return NextResponse.json({ error: "لم يتم العثور على الملف في التخزين الآمن." }, { status: 422 });
    if (object.size <= 0 || object.size > rule.maxBytes) return NextResponse.json({ error: "حجم الملف المخزن غير صالح." }, { status: 422 });
    if (object.contentType && !(rule.types as readonly string[]).includes(object.contentType)) return NextResponse.json({ error: "نوع الملف المخزن غير مسموح." }, { status: 422 });

    const outcome = await db.transaction(async (tx) => {
      const [confirmed] = await tx.update(agentDocuments).set({ status: "pending" }).where(and(eq(agentDocuments.id, doc.id), eq(agentDocuments.status, "uploading"))).returning();
      if (!confirmed) return null;

      const shouldOpenReview = agent.verificationStatus === "pending";
      const shouldReReviewVerified = agent.verificationStatus === "verified" && TRUST_CRITICAL_DOCUMENTS.has(doc.documentType);
      if (shouldOpenReview || shouldReReviewVerified) {
        await tx.update(agents).set({
          verificationStatus: "in_review",
          ...(shouldReReviewVerified ? { verifiedAt: null } : {}),
        }).where(and(eq(agents.id, agent.id), eq(agents.verificationStatus, agent.verificationStatus)));
      }

      await tx.insert(auditLog).values({
        actor: `agent:${agent.id}`,
        action: "kyc_document_upload_confirmed",
        targetType: "agent",
        targetId: agent.id,
        reason: `Upload confirmed ${doc.documentType}: ${doc.originalName}`,
        meta: JSON.stringify({ documentId: doc.id, size: object.size, contentType: object.contentType }),
      });
      return confirmed;
    });

    if (!outcome) return NextResponse.json({ error: "تغيّرت حالة المستند أثناء التأكيد. حدّث الصفحة وحاول مرة أخرى." }, { status: 409 });
    return NextResponse.json({ ok: true, stored: true, document: { id: outcome.id, documentType: outcome.documentType, originalName: outcome.originalName, status: outcome.status, stored: true, size: object.size } });
  }

  const documentType = data.documentType;
  const originalName = clean(data.originalName, 180);
  const contentType = clean(data.contentType, 100);
  const contentLength = Number(data.contentLength);
  if (typeof documentType !== "string" || !Object.hasOwn(DOCUMENT_RULES, documentType)) return NextResponse.json({ error: "نوع المستند غير مسموح." }, { status: 422 });
  const rule = DOCUMENT_RULES[documentType as DocumentType];
  if (!originalName || !contentType || !Number.isInteger(contentLength) || contentLength <= 0 || contentLength > rule.maxBytes) return NextResponse.json({ error: "الملف غير صالح أو يتجاوز الحد المسموح (10MB)." }, { status: 422 });
  if (!(rule.types as readonly string[]).includes(contentType)) return NextResponse.json({ error: "يسمح فقط بـ PDF أو JPG أو PNG." }, { status: 422 });
  const storageKey = privateStorageProvider.generatePrivateStorageKey(agent.id, documentType, originalName);
  const signed = await privateStorageProvider.getPresignedUploadUrl(storageKey, contentType, contentLength);
  const [doc] = await db.insert(agentDocuments).values({ agentId: agent.id, documentType, storageKey, originalName, status: "uploading" }).returning();
  await db.insert(auditLog).values({ actor: `agent:${agent.id}`, action: "kyc_document_upload_started", targetType: "agent", targetId: agent.id, reason: `Upload started ${documentType}: ${originalName}` });
  return NextResponse.json({ document: { id: doc.id, documentType: doc.documentType, originalName: doc.originalName, status: doc.status }, upload: signed });
}
