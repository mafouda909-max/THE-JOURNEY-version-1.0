import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentDocuments, auditLog } from "@/db/schema";
import { accountFromRequest, requireAccount } from "@/lib/identity";
import { privateObjectInfo } from "@/lib/b2";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["identity", "license", "commercial_register", "tax_id"]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const account = await accountFromRequest(request);
  const denied = requireAccount(account, ["agent"]);
  if (denied) return denied;
  if (!account?.agentId) return NextResponse.json({ error: "حساب الوكيل غير مرتبط بملف وكيل." }, { status: 409 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات غير صالحة." }, { status: 400 }); }
  const documentId = Number((body as Record<string, unknown> | null)?.documentId);
  if (!Number.isInteger(documentId) || documentId <= 0) return NextResponse.json({ error: "معرّف المستند غير صالح." }, { status: 422 });

  const rows = await db.select().from(agentDocuments).where(eq(agentDocuments.id, documentId)).limit(1);
  const doc = rows[0];
  if (!doc || doc.agentId !== account.agentId) return NextResponse.json({ error: "المستند غير موجود لهذا الحساب." }, { status: 404 });
  if (!ALLOWED_TYPES.has(doc.documentType)) return NextResponse.json({ error: "نوع المستند غير مسموح." }, { status: 422 });

  const object = await privateObjectInfo(doc.storageKey);
  if (!object) return NextResponse.json({ error: "لم يتم العثور على الملف فعليًا في التخزين الآمن." }, { status: 409 });
  if (object.size <= 0 || object.size > MAX_BYTES) return NextResponse.json({ error: "الملف الموجود في التخزين غير صالح أو يتجاوز 10MB." }, { status: 422 });

  const [updated] = await db.update(agentDocuments).set({ status: "pending" }).where(eq(agentDocuments.id, doc.id)).returning();
  await db.insert(auditLog).values({
    actor: "agent",
    action: "kyc_document_upload_confirmed",
    targetType: "agent",
    targetId: account.agentId,
    reason: `Storage object confirmed for ${doc.documentType}: ${doc.originalName}`,
    meta: JSON.stringify({ documentId: doc.id, size: object.size, contentType: object.contentType }),
  });

  return NextResponse.json({ ok: true, document: { id: updated.id, status: updated.status, size: object.size, contentType: object.contentType } });
}
