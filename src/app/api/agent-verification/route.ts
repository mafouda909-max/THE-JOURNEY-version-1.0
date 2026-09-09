import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, agentDocuments, auditLog } from "@/db/schema";
import { accountFromRequest, requireAccount } from "@/lib/identity";
import { privateStorageProvider } from "@/lib/private-storage";

export const dynamic = "force-dynamic";

const DOCUMENT_RULES = {
  identity: { maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "application/pdf"] },
  license: { maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "application/pdf"] },
  commercial_register: { maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "application/pdf"] },
  tax_id: { maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "application/pdf"] },
} as const;

type DocumentType = keyof typeof DOCUMENT_RULES;

function clean(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function getOwnedAgent(request: Request) {
  const account = await accountFromRequest(request);
  const denied = requireAccount(account, ["agent"]);
  if (denied) return { denied };
  if (!account?.agentId) {
    return { denied: NextResponse.json({ error: "حساب الوكيل غير مرتبط بملف وكيل." }, { status: 409 }) };
  }
  const rows = await db.select().from(agents).where(eq(agents.id, account.agentId)).limit(1);
  if (!rows[0]) {
    return { denied: NextResponse.json({ error: "ملف الوكيل غير موجود." }, { status: 404 }) };
  }
  return { account, agent: rows[0] };
}

export async function GET(request: Request) {
  const result = await getOwnedAgent(request);
  if (result.denied) return result.denied;

  const docs = await db
    .select({
      id: agentDocuments.id,
      documentType: agentDocuments.documentType,
      originalName: agentDocuments.originalName,
      status: agentDocuments.status,
      rejectionReason: agentDocuments.rejectionReason,
      expiresAt: agentDocuments.expiresAt,
      createdAt: agentDocuments.createdAt,
    })
    .from(agentDocuments)
    .where(eq(agentDocuments.agentId, result.agent!.id));

  return NextResponse.json({
    accountEmail: result.account!.email,
    agent: {
      id: result.agent!.id,
      displayName: result.agent!.displayName,
      latinName: result.agent!.latinName,
      bio: result.agent!.bio,
      city: result.agent!.city,
      country: result.agent!.country,
      licenseType: result.agent!.licenseType,
      licenseNumber: result.agent!.licenseNumber,
      verificationStatus: result.agent!.verificationStatus,
    },
    documents: docs,
  });
}

export async function PATCH(request: Request) {
  const result = await getOwnedAgent(request);
  if (result.denied) return result.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات غير صالحة." }, { status: 400 });
  }

  const data = (body ?? {}) as Record<string, unknown>;
  const displayName = clean(data.displayName, 120);
  const latinName = clean(data.latinName, 120);
  const bio = clean(data.bio, 1200);
  const city = clean(data.city, 120);
  const country = clean(data.country, 120);
  const licenseType = data.licenseType === "agency" ? "agency" : "individual";
  const licenseNumber = clean(data.licenseNumber, 40);

  if (!displayName || !latinName || !bio || !city || !country) {
    return NextResponse.json({ error: "أكمل الاسم، الاسم اللاتيني، النبذة، الدولة والمدينة." }, { status: 422 });
  }
  if (bio.length < 30) {
    return NextResponse.json({ error: "النبذة المهنية يجب أن تكون ٣٠ حرفاً على الأقل." }, { status: 422 });
  }
  if (licenseType === "agency" && !licenseNumber) {
    return NextResponse.json({ error: "رقم الترخيص مطلوب للحساب المؤسسي." }, { status: 422 });
  }

  const [updated] = await db
    .update(agents)
    .set({ displayName, latinName, bio, city, country, licenseType, licenseNumber: licenseNumber || null })
    .where(eq(agents.id, result.agent!.id))
    .returning();

  await db.insert(auditLog).values({
    actor: "agent",
    action: "agent_profile_updated",
    targetType: "agent",
    targetId: updated.id,
    reason: "Verification onboarding profile updated",
    prevState: result.agent!.verificationStatus,
    newState: result.agent!.verificationStatus,
  });

  return NextResponse.json({ agent: updated });
}

export async function POST(request: Request) {
  const result = await getOwnedAgent(request);
  if (result.denied) return result.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات غير صالحة." }, { status: 400 });
  }

  const data = (body ?? {}) as Record<string, unknown>;
  const documentType = data.documentType;
  const originalName = clean(data.originalName, 180);
  const contentType = clean(data.contentType, 100);
  const contentLength = Number(data.contentLength);

  if (typeof documentType !== "string" || !(documentType in DOCUMENT_RULES)) {
    return NextResponse.json({ error: "نوع المستند غير مسموح." }, { status: 422 });
  }
  const rule = DOCUMENT_RULES[documentType as DocumentType];
  if (!originalName || !contentType || !Number.isInteger(contentLength) || contentLength <= 0 || contentLength > rule.maxBytes) {
    return NextResponse.json({ error: "الملف غير صالح أو يتجاوز الحد المسموح (10MB)." }, { status: 422 });
  }
  if (!(rule.types as readonly string[]).includes(contentType)) {
    return NextResponse.json({ error: "يسمح فقط بـ PDF أو JPG أو PNG." }, { status: 422 });
  }

  const storageKey = privateStorageProvider.generatePrivateStorageKey(result.agent!.id, documentType, originalName);
  const signed = await privateStorageProvider.getPresignedUploadUrl(storageKey, contentType);

  const [doc] = await db
    .insert(agentDocuments)
    .values({
      agentId: result.agent!.id,
      documentType,
      storageKey,
      originalName,
      status: "pending",
    })
    .returning();

  if (result.agent!.verificationStatus === "pending") {
    await db
      .update(agents)
      .set({ verificationStatus: "in_review" })
      .where(and(eq(agents.id, result.agent!.id), eq(agents.verificationStatus, "pending")));
  }

  await db.insert(auditLog).values({
    actor: "agent",
    action: "kyc_document_submitted",
    targetType: "agent",
    targetId: result.agent!.id,
    reason: `Uploaded ${documentType}: ${originalName}`,
  });

  return NextResponse.json({
    document: {
      id: doc.id,
      documentType: doc.documentType,
      originalName: doc.originalName,
      status: doc.status,
    },
    upload: signed,
  });
}
