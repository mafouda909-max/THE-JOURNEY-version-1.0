import { NextResponse } from "next/server";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentDocuments, agents, auditLog } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { accountIdForAgent, notify } from "@/lib/notify";
import { validDocumentEvidence } from "@/lib/document-evidence";
import { privateObjectInfo } from "@/lib/b2";

export const dynamic = "force-dynamic";

const TRANSITIONS: Record<string, { from: string[]; to: string; needsReason: boolean }> = {
  verify: { from: ["pending", "in_review"], to: "verified", needsReason: false },
  reject: { from: ["pending", "in_review"], to: "rejected", needsReason: true },
  suspend: { from: ["verified"], to: "suspended", needsReason: true },
  reinstate: { from: ["suspended", "rejected"], to: "in_review", needsReason: false },
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const parsed = Number(id);
  if (!Number.isInteger(parsed)) return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, reason } = (body ?? {}) as Record<string, unknown>;
  const rule = typeof action === "string" && Object.hasOwn(TRANSITIONS, action) ? TRANSITIONS[action] : undefined;
  if (!rule) {
    return NextResponse.json({ error: "الإجراء يجب أن يكون: verify / reject / suspend / reinstate" }, { status: 422 });
  }
  if (rule.needsReason && (typeof reason !== "string" || reason.trim().length < 10)) {
    return NextResponse.json({ error: "السبب مطلوب (١٠ أحرف على الأقل) ويُوثَّق في سجل القرارات." }, { status: 422 });
  }

  const rows = await db.select().from(agents).where(eq(agents.id, parsed)).limit(1);
  const agent = rows[0];
  if (!agent) return NextResponse.json({ error: "الوكيل غير موجود" }, { status: 404 });
  if (!rule.from.includes(agent.verificationStatus)) {
    return NextResponse.json({ error: `لا يمكن تنفيذ «${action}» من الحالة «${agent.verificationStatus}».` }, { status: 422 });
  }

  const validatedIds: number[] = [];
  if (action === "verify") {
    const docs = await db
      .select()
      .from(agentDocuments)
      .where(eq(agentDocuments.agentId, parsed));
    const required = agent.licenseType === "agency" ? ["identity", "license", "commercial_register"] : ["identity", "license"];

    const missing: string[] = [];
    for (const type of required) {
      const candidates = docs.filter(
        (d) => d.documentType === type && (d.status === "pending" || d.status === "verified"),
      );
      let exists = false;
      for (const doc of candidates) {
        if (validDocumentEvidence(parsed, doc, await privateObjectInfo(doc.storageKey))) {
          validatedIds.push(doc.id);
          exists = true;
          break;
        }
      }
      if (!exists) missing.push(type);
    }

    if (missing.length > 0) {
      return NextResponse.json({ error: `لا يمكن اعتماد الوكيل قبل استلام أدلة التوثيق المطلوبة فعليًا: ${missing.join("، ")}.` }, { status: 422 });
    }
  }

  const [updated] = await db
    .update(agents)
    .set({ verificationStatus: rule.to, ...(rule.to === "verified" ? { verifiedAt: new Date() } : {}) })
    .where(and(
      eq(agents.id, parsed), eq(agents.verificationStatus, agent.verificationStatus),
      eq(agents.displayName, agent.displayName), eq(agents.latinName, agent.latinName),
      eq(agents.bio, agent.bio), eq(agents.city, agent.city), eq(agents.country, agent.country),
      eq(agents.licenseType, agent.licenseType),
      sql`${agents.licenseNumber} IS NOT DISTINCT FROM ${agent.licenseNumber}`,
    ))
    .returning();
  if (!updated) return NextResponse.json({ error: "Agent profile changed during review; reload and review again" }, { status: 409 });

  if (action === "verify") {
    await db.update(agentDocuments).set({ status: "verified", verifiedAt: new Date(), rejectionReason: null }).where(and(eq(agentDocuments.agentId, parsed), inArray(agentDocuments.id, validatedIds)));
  } else if (action === "reject") {
    await db.update(agentDocuments).set({ status: "rejected", rejectionReason: typeof reason === "string" ? reason.trim() : null }).where(eq(agentDocuments.agentId, parsed));
  }

  await db.insert(auditLog).values({
    actor: "admin",
    action: `agent_${action}`,
    targetType: "agent",
    targetId: updated.id,
    reason: typeof reason === "string" && reason.trim() ? reason.trim() : null,
    prevState: agent.verificationStatus,
    newState: updated.verificationStatus,
    meta: updated.displayName.slice(0, 120),
  });

  const ownerId = await accountIdForAgent(updated.id);
  if (ownerId) {
    const titles: Record<string, string> = {
      agent_verify: "تم اعتماد توثيقك",
      agent_reject: "قرار مراجعة ملفك",
      agent_suspend: "إيقاف حسابك مؤقتًا",
      agent_reinstate: "إعادة فتح ملفك",
    };
    const bodies: Record<string, string> = {
      agent_verify: "مبارك — أصبحت وكيلًا موثّقًا. ملفك مرئي للمسافرين ويمكنك الآن إنشاء العروض من لوحتك.",
      agent_reject: `لم يُعتمد ملفك هذه المرة. السبب: ${typeof reason === "string" ? reason.trim() : "—"}. يمكنك إعادة التقديم بعد ٣٠ يومًا.`,
      agent_suspend: `أوقف حسابك مؤقتًا بقرار موثَّق. السبب: ${typeof reason === "string" ? reason.trim() : "—"}. راسل الدعم للمراجعة.`,
      agent_reinstate: "أُعيد فتح ملف توثيقك للمراجعة — القرار الجديد يصلك هنا.",
    };
    void notify({ accountId: ownerId, type: `agent_${action}`, title: titles[`agent_${action}`] ?? "تحديث حالة التوثيق", body: bodies[`agent_${action}`] ?? "", link: "/account", targetId: updated.id });
  }

  return NextResponse.json({ agent: updated });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = Number(id);
  if (!Number.isInteger(parsed)) return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  const rows = await db.select().from(agents).where(eq(agents.id, parsed)).limit(1);
  if (!rows[0]) return NextResponse.json({ agent: null }, { status: 404 });
  return NextResponse.json({ agent: rows[0] });
}
