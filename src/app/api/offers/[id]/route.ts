import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, auditLog, offers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { accountIdForAgent, notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

const NINETY_DAYS = 90 * 86_400_000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = Number(id);
  if (!Number.isInteger(parsed)) {
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
  return NextResponse.json({ offer: { ...rows[0].offer, agent: rows[0].agent } });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  const parsed = Number(id);
  if (!Number.isInteger(parsed)) {
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
    if (typeof reason !== "string" || reason.trim().length < 10) {
      return NextResponse.json(
        { error: "سبب الرفض مطلوب — عشرة أحرف على الأقل، ويُرسل للوكيل." },
        { status: 422 },
      );
    }
  }

  const now = new Date();
  const [updated] = await db
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
    .where(eq(offers.id, parsed))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "العرض غير موجود" }, { status: 404 });
  }

  // Immutable decision trail (§24): who decided, what changed, why
  await db.insert(auditLog).values({
    actor: "admin",
    action: action === "approve" ? "offer_approved" : "offer_rejected",
    targetType: "offer",
    targetId: updated.id,
    reason: action === "reject" ? (reason as string).trim() : "استوفى قائمة مراجعة الجودة",
    prevState: "pending_review",
    newState: updated.status,
    meta: `price=${updated.priceAmount}${updated.currency}`,
  });

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
