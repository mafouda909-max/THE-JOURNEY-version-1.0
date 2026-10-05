import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentDocuments, auditLog } from "@/db/schema";
import { accountFromRequest, requireAccount } from "@/lib/identity";
import { resolveAuthOriginForRequest } from "@/lib/auth-origin";
import { SITE_ORIGIN } from "@/lib/site";
import { DOCUMENT_MIME_TYPES, validDocumentEvidence } from "@/lib/document-evidence";
import { readPrivateUploadBody, matchesDocumentContent } from "@/lib/private-upload-body";
import { transferPrivateDocument } from "@/lib/storage-gateway";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: Request) {
  const account = await accountFromRequest(request);
  const denied = requireAccount(account, ["agent"]);
  if (denied) return denied;
  if (!account?.agentId) return NextResponse.json({ error: "ملف الوكيل غير موجود." }, { status: 409 });
  const origin = resolveAuthOriginForRequest(request.url, SITE_ORIGIN);
  if (!origin || request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "طلب الرفع غير مسموح من هذا المصدر." }, { status: 403 });
  }
  const limit = rateLimiter.checkRateLimit(`private-upload:${account.id}`, 12, 600);
  if (!limit.allowed) return NextResponse.json({ error: "انتظر قليلًا قبل إعادة الرفع." }, { status: 429, headers: { "Retry-After": String(limit.resetSeconds) } });
  const rawId = new URL(request.url).searchParams.get("documentId") ?? "";
  if (!/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(Number(rawId))) return NextResponse.json({ error: "معرّف المستند غير صالح." }, { status: 422 });
  const contentType = request.headers.get("content-type") ?? "";
  if (!DOCUMENT_MIME_TYPES.includes(contentType)) return NextResponse.json({ error: "يسمح فقط بـ PDF أو JPG أو PNG." }, { status: 422 });

  // Check ownership/state before reading any file. The transaction rechecks and
  // locks the document so review/confirmation cannot race an overwrite.
  const owned = await db.select().from(agentDocuments).where(and(eq(agentDocuments.id, Number(rawId)), eq(agentDocuments.agentId, account.agentId))).limit(1);
  if (!owned[0]) return NextResponse.json({ error: "المستند غير موجود." }, { status: 404 });
  const available = (doc: typeof agentDocuments.$inferSelect) => doc.status === "uploading" &&
    doc.createdAt.getTime() <= Date.now() + 5000 && doc.createdAt.getTime() > Date.now() - 600_000 &&
    validDocumentEvidence(account.agentId!, doc, { size: 1, contentType });
  if (!available(owned[0])) return NextResponse.json({ error: "انتهى طلب الرفع أو تغيّرت حالة المستند. جهّز رفعًا جديدًا." }, { status: 409 });

  let bytes: Buffer;
  try { bytes = await readPrivateUploadBody(request, AbortSignal.any([request.signal, AbortSignal.timeout(15000)])); }
  catch (error) {
    return NextResponse.json({ error: error instanceof RangeError ? "استخدم ملفًا صالحًا حتى 3MB." : "لم يكتمل إرسال الملف. حاول مرة أخرى." }, { status: error instanceof RangeError ? 413 : 408 });
  }
  if (!matchesDocumentContent(bytes, contentType)) return NextResponse.json({ error: "محتوى الملف لا يطابق نوعه. استخدم PDF أو JPG أو PNG صالحًا." }, { status: 422 });
  try {
    const transferred = await db.transaction(async (tx) => {
      const [document] = await tx.select().from(agentDocuments).where(and(eq(agentDocuments.id, Number(rawId)), eq(agentDocuments.agentId, account.agentId!))).limit(1).for("update");
      if (!document || !available(document)) return false;
      await transferPrivateDocument(document.storageKey, bytes, contentType);
      await tx.insert(auditLog).values({ actor: `agent:${account.agentId}`, action: "kyc_document_transferred", targetType: "agent", targetId: account.agentId!, meta: JSON.stringify({ documentId: document.id, size: bytes.length, contentType, transport: "same_origin" }) });
      return true;
    });
    if (!transferred) return NextResponse.json({ error: "تغيّرت حالة المستند أثناء الرفع. أعد فتح الصفحة." }, { status: 409 });
    // Transfer alone never promotes evidence to pending/verified. The existing
    // confirm command must verify provider HEAD and commit its state/audit.
    return NextResponse.json({ transferred: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "تعذر تثبيت وصول الملف إلى التخزين الخاص. لم يُعتمد الرفع؛ حاول مجددًا." }, { status: 503, headers: { "Retry-After": "15" } });
  }
}
