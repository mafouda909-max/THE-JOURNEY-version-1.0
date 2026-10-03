import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLog, communityPosts } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { isCommunityEnabled } from "@/lib/community";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isCommunityEnabled()) {
    return NextResponse.json({ error: "Community disabled" }, { status: 503 });
  }

  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId < 1) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action =
    typeof (body as Record<string, unknown>)?.action === "string"
      ? String((body as Record<string, unknown>).action)
      : "";

  const nextStatus =
    action === "publish"
      ? "published"
      : action === "reject"
        ? "rejected"
        : action === "hide"
          ? "hidden"
          : null;

  if (!nextStatus) {
    return NextResponse.json({ error: "Unknown moderation action" }, { status: 422 });
  }

  const updated = await db
    .update(communityPosts)
    .set({
      status: nextStatus,
      publishedAt: nextStatus === "published" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(communityPosts.id, postId))
    .returning({ id: communityPosts.id });

  if (!updated[0]) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  await db.insert(auditLog).values({
    actor: "community_moderator",
    action: `community_post_${nextStatus}`,
    targetType: "community_post",
    targetId: postId,
    newState: nextStatus,
  });

  return NextResponse.json({ id: postId, status: nextStatus });
}
