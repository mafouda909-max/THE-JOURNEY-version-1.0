import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, contactRequests } from "@/db/schema";
import { accountFromRequest } from "@/lib/identity";
import {
  canTransitionContact,
  isContactStatus,
} from "@/lib/contact-state";

export const dynamic = "force-dynamic";

/**
 * Contact-request lifecycle — owner-agent or admin may drive the status
 * (policy §13: new → viewed → responded → closed). Illegal transitions are
 * rejected server-side and every transition is audited.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const account = await accountFromRequest(request);
  if (!account) {
    return NextResponse.json({ error: "Unauthorized — سجّل الدخول أولاً." }, { status: 401 });
  }

  const { id } = await params;
  const parsed = Number(id);
  if (!Number.isInteger(parsed)) {
    return NextResponse.json({ error: "Invalid contact request id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { to } = (body ?? {}) as Record<string, unknown>;
  if (typeof to !== "string" || !isContactStatus(to)) {
    return NextResponse.json(
      { error: "الحالة يجب أن تكون: new / viewed / responded / closed" },
      { status: 422 },
    );
  }

  const rows = await db
    .select()
    .from(contactRequests)
    .where(eq(contactRequests.id, parsed))
    .limit(1);
  const cr = rows[0];
  if (!cr) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }

  // Owner boundary: only the request's owning agent (or an admin) may drive it.
  const isAdmin = account.role === "admin";
  const isOwner = Boolean(account.agentId && account.agentId === cr.agentId);
  if (!isAdmin && !isOwner) {
    return NextResponse.json(
      { error: "Forbidden — لا تملك صلاحية تحديث هذا الطلب." },
      { status: 403 },
    );
  }

  if (!canTransitionContact(cr.status, to)) {
    return NextResponse.json(
      {
        error: `الانتقال من «${cr.status}» إلى «${to}» غير مسموح — تسلسل الحالة: new → viewed → responded → closed.`,
      },
      { status: 422 },
    );
  }

  const now = new Date();
  const [updated] = await db
    .update(contactRequests)
    .set({
      status: to,
      ...(to === "responded" || to === "closed"
        ? { respondedAt: cr.respondedAt ?? now }
        : {}),
    })
    .where(eq(contactRequests.id, parsed))
    .returning();

  await db.insert(auditLog).values({
    actor: isAdmin ? "admin" : `agent:${account.agentId}`,
    action: "contact_status",
    targetType: "contact_request",
    targetId: updated.id,
    reason: null,
    prevState: cr.status,
    newState: updated.status as string,
    meta: `offer=${updated.offerId}`,
  });

  return NextResponse.json({ contactRequest: updated });
}
