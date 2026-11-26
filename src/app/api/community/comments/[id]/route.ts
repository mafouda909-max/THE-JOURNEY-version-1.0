import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, communityComments, communityPosts } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { isCommunityEnabled } from "@/lib/community";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isCommunityEnabled()) {
    return NextResponse.json({ error: "Community disabled" }, { status: 503, headers: NO_STORE });
  }

  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const commentId = Number(id);
  if (!Number.isSafeInteger(commentId) || commentId < 1) {
    return NextResponse.json({ error: "Invalid comment id" }, { status: 400, headers: NO_STORE });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: NO_STORE });
  }

  const data = (payload ?? {}) as Record<string, unknown>;
  const action = typeof data.action === "string" ? data.action : "";
  if (!["publish", "reject", "hide"].includes(action)) {
    return NextResponse.json({ error: "Unknown moderation action" }, { status: 422, headers: NO_STORE });
  }

  const reason = typeof data.reason === "string" ? data.reason.trim().slice(0, 500) : "";
  if ((action === "reject" || action === "hide") && reason.length < 5) {
    return NextResponse.json(
      { error: "سبب الإجراء مطلوب (5 أحرف على الأقل)." },
      { status: 422, headers: NO_STORE },
    );
  }

  const outcome = await db.transaction(async (tx) => {
    // Serialize moderation changes per post before changing comment visibility.
    const [seed] = await tx
      .select({ postId: communityComments.postId })
      .from(communityComments)
      .where(eq(communityComments.id, commentId))
      .limit(1);

    if (!seed) return { ok: false as const, status: 404, error: "التعليق غير موجود." };

    const lockedPost = await tx
      .select({ id: communityPosts.id })
      .from(communityPosts)
      .where(eq(communityPosts.id, seed.postId))
      .for("update")
      .limit(1);

    if (!lockedPost[0]) return { ok: false as const, status: 404, error: "المشاركة الأصلية غير موجودة." };

    const [comment] = await tx
      .select({
        id: communityComments.id,
        postId: communityComments.postId,
        parentCommentId: communityComments.parentCommentId,
        status: communityComments.status,
      })
      .from(communityComments)
      .where(eq(communityComments.id, commentId))
      .limit(1);

    if (!comment) return { ok: false as const, status: 404, error: "التعليق غير موجود." };

    let nextStatus: string;
    if (action === "publish") {
      if (comment.status !== "pending_review") {
        return { ok: false as const, status: 409, error: "حالة التعليق تغيّرت؛ حدّث قائمة المراجعة." };
      }

      if (comment.parentCommentId !== null) {
        const [parent] = await tx
          .select({
            parentCommentId: communityComments.parentCommentId,
            status: communityComments.status,
          })
          .from(communityComments)
          .where(eq(communityComments.id, comment.parentCommentId))
          .limit(1);

        if (!parent || parent.status !== "published" || parent.parentCommentId !== null) {
          return { ok: false as const, status: 409, error: "لا يمكن نشر الرد قبل أن يكون التعليق الأصلي منشوراً." };
        }
      }

      await tx
        .update(communityComments)
        .set({ status: "published", publishedAt: new Date() })
        .where(and(eq(communityComments.id, commentId), eq(communityComments.status, "pending_review")));

      await tx
        .update(communityPosts)
        .set({ commentCount: sql`${communityPosts.commentCount} + 1`, updatedAt: new Date() })
        .where(eq(communityPosts.id, comment.postId));

      nextStatus = "published";
    } else if (action === "reject") {
      if (comment.status !== "pending_review") {
        return { ok: false as const, status: 409, error: "لا يمكن رفض تعليق خرج من قائمة المراجعة." };
      }

      await tx
        .update(communityComments)
        .set({ status: "rejected", publishedAt: null })
        .where(and(eq(communityComments.id, commentId), eq(communityComments.status, "pending_review")));

      nextStatus = "rejected";
    } else {
      if (comment.status !== "published") {
        return { ok: false as const, status: 409, error: "لا يمكن إخفاء تعليق غير منشور." };
      }

      let decrement = 1;
      if (comment.parentCommentId === null) {
        const publishedReplies = await tx
          .select({ id: communityComments.id })
          .from(communityComments)
          .where(
            and(
              eq(communityComments.parentCommentId, commentId),
              eq(communityComments.status, "published"),
            ),
          );
        decrement += publishedReplies.length;

        await tx
          .update(communityComments)
          .set({ status: "hidden", publishedAt: null })
          .where(
            and(
              eq(communityComments.parentCommentId, commentId),
              inArray(communityComments.status, ["pending_review", "published"]),
            ),
          );
      }

      await tx
        .update(communityComments)
        .set({ status: "hidden", publishedAt: null })
        .where(and(eq(communityComments.id, commentId), eq(communityComments.status, "published")));

      await tx
        .update(communityPosts)
        .set({
          commentCount: sql`GREATEST(${communityPosts.commentCount} - ${decrement}, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(communityPosts.id, comment.postId));

      nextStatus = "hidden";
    }

    await tx.insert(auditLog).values({
      actor: "community_moderator",
      action: "community_comment_" + nextStatus,
      targetType: "community_comment",
      targetId: commentId,
      reason: reason || "moderation action=" + nextStatus,
      prevState: comment.status,
      newState: nextStatus,
    });

    return { ok: true as const, id: commentId, postId: comment.postId, status: nextStatus };
  });

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status, headers: NO_STORE });
  }

  return NextResponse.json(outcome, { headers: NO_STORE });
}
