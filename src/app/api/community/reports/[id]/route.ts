import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, communityReports } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { isCommunityEnabled } from "@/lib/community";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isCommunityEnabled()) {
    return NextResponse.json({ error: "المجتمع غير مفعّل في هذه البيئة." }, { status: 503, headers: NO_STORE });
  }

  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const reportId = Number(id);
  if (!Number.isSafeInteger(reportId) || reportId < 1) {
    return NextResponse.json({ error: "Invalid report id" }, { status: 400, headers: NO_STORE });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: NO_STORE });
  }

  const data = (payload ?? {}) as Record<string, unknown>;
  const action = typeof data.action === "string" ? data.action : "";
  if (action !== "resolve" && action !== "dismiss") {
    return NextResponse.json({ error: "Unknown review action" }, { status: 422, headers: NO_STORE });
  }

  const note = typeof data.note === "string" ? data.note.trim().slice(0, 500) : "";
  if (note.length < 5) {
    return NextResponse.json({ error: "اكتب ملحوظة مراجعة من 5 أحرف على الأقل." }, { status: 422, headers: NO_STORE });
  }

  const outcome = await db.transaction(async (tx) => {
    const [report] = await tx
      .select({
        id: communityReports.id,
        status: communityReports.status,
        targetType: communityReports.targetType,
        postId: communityReports.postId,
        commentId: communityReports.commentId,
      })
      .from(communityReports)
      .where(eq(communityReports.id, reportId))
      .for("update")
      .limit(1);

    if (!report) return { ok: false as const, status: 404, error: "البلاغ غير موجود." };
    if (report.status !== "pending_review") {
      return { ok: false as const, status: 409, error: "تمت مراجعة البلاغ من قبل." };
    }

    const nextStatus = action === "resolve" ? "resolved" : "dismissed";
    await tx
      .update(communityReports)
      .set({
        status: nextStatus,
        moderatorNote: note,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(communityReports.id, reportId), eq(communityReports.status, "pending_review")));

    await tx.insert(auditLog).values({
      actor: "community_moderator",
      action: "community_report_" + nextStatus,
      targetType: "community_report",
      targetId: reportId,
      reason: note,
      prevState: report.status,
      newState: nextStatus,
    });

    return {
      ok: true as const,
      id: reportId,
      status: nextStatus,
      targetType: report.targetType,
      postId: report.postId,
      commentId: report.commentId,
    };
  });

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status, headers: NO_STORE });
  }

  return NextResponse.json(outcome, { headers: NO_STORE });
}
