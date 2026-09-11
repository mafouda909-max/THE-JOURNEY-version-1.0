import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, auditLog, offers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { accountIdForAgent, notify } from "@/lib/notify";
import { toPublicAgent } from "@/lib/public-agent";

export const dynamic = "force-dynamic";

const NINETY_DAYS = 90 * 86_400_000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return NextResponse.json({ error: "Invalid offer id" }, { status: 400 });
  }

  const rows = await db
    .select({ offer: offers, agent: agents })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(eq(offers.id, parsed))
    .limit(1);

  if (!rows[0]) {
    return NextResponse.json({ error: "العرض غير موجود" }, { status: 404 });
  }
  const { offer, agent } = rows[0];
  const expired = offer.expiresAt !== null && offer.expiresAt.getTime() <= Date.now();
  if (offer.status !== "published" || agent.verificationStatus !== "verified" || expired) {
    return NextResponse.json({ error: "العرض غير متاح" }, { status: 404 });
  }
  return NextResponse.json({ offer: { ...offer, agent: toPublicAgent(agent) } });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return NextResponse.json({ error: "Invalid offer id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, reason } = (body ?? {}) as Record<string, unknown>;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "Action must be 'approve' or 'reject'" },
      { status: 422 },
    );
  }

  if (action === "reject") {
    if (typeof reason !== "string" || reason.trim().length < 10 || reason.trim().length > 1000) {
      return NextResponse.json(
        { error: "سبب الرفض مطلوب بين ١٠ و١٠٠٠ حرف، ويُرسل للوكيل." },
        { status: 422 },
      );
    }
  }

  const currentRows = await db
    .select({ offer: offers, agentStatus: agents.verificationStatus })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(eq(offers.id, parsed))
    .limit(1);
  const current = currentRows[0];
  if (!current) {
    return NextResponse.json({ error: "العرض غير موجود" }, { status: 404 });
  }
  if (current.offer.status !== "pending_review") {
    return NextResponse.json(
      { error: `العرض لم يعد بانتظار المراجعة؛ حالته الحالية «${current.offer.status}». حدّث الطابور قبل اتخاذ قرار جديد.` },
      { status: 409 },
    );
  }
  if (action === "approve" && current.agentStatus !== "verified") {
    return NextResponse.json(
      { error: "لا يمكن نشر عرض لوكيل غير موثّق حاليًا." },
      { status: 422 },
    );
  }

  const now = new Date();
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(offers)
      .set(
        action === "approve"
          ? {
              status: "published",
              rejectionReason: null,
              publishedAt: now,
              expiresAt: new Date(now.getTime() + NINETY_DAYS),
            }
          : {
              status: "rejected",
              rejectionReason: (reason as string).trim(),
              publishedAt: null,
              expiresAt: null,
            },
      )
      .where(and(eq(offers.id, parsed), eq(offers.status, "pending_review")))
      .returning();

    if (!row) return null;

    await tx.insert(auditLog).values({
      actor: "admin",
      action: action === "approve" ? "offer_approved" : "offer_rejected",
      targetType: "offer",
      targetId: row.id,
      reason: action === "reject" ? (reason as string).trim() : "استوفى قائمة مراجعة الجودة",
      prevState: "pending_review",
      newState: row.status,
      meta: `price=${row.priceAmount}${row.currency}`,
    });
    return row;
  });

  if (!updated) {
    return NextResponse.json(
      { error: "تغيّرت حالة العرض أثناء المراجعة. حدّث الصفحة وأعد المحاولة." },
      { status: 409 },
    );
  }

  const ownerId = await accountIdForAgent(updated.agentId);
  if (ownerId) {
    void notify({
      accountId: ownerId,
      type: action === "approve" ? "offer_approved" : "offer_rejected",
      title: action === "approve" ? "عُرضك نُشر" : "لم يُعتمد عرضك",
      body:
        action === "approve"
          ? `«${updated.title}» منشور الآن لمدة ٩٠ يومًا — طلبات المسافرين تصل لوحتك مباشرة.`
          : `«${updated.title}» لم يُعتمد. السبب: ${updated.rejectionReason ?? "—"}. عدّل العرض وأعد إرساله.`,
      link: "/account",
      targetId: updated.id,
    });
  }

  return NextResponse.json({ offer: updated });
}
