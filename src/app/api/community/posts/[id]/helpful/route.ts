import { NextResponse } from "next/server";
import { db } from "@/db";
import { communityPosts, communityReactions } from "@/db/schema";
import { accountFromRequest } from "@/lib/identity";
import { isCommunityEnabled } from "@/lib/community";
import { eq, sql } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isCommunityEnabled()) {
    return NextResponse.json({ error: "Community disabled" }, { status: 503 });
  }

  const account = await accountFromRequest(request);
  if (!account) {
    return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  }

  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId < 1) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  const post = await db
    .select({ id: communityPosts.id, status: communityPosts.status })
    .from(communityPosts)
    .where(eq(communityPosts.id, postId))
    .limit(1);

  if (!post[0] || post[0].status !== "published") {
    return NextResponse.json({ error: "المشاركة غير متاحة." }, { status: 404 });
  }

  const inserted = await db
    .insert(communityReactions)
    .values({
      postId,
      accountId: account.id,
      type: "helpful",
    })
    .onConflictDoNothing()
    .returning({ id: communityReactions.id });

  if (inserted.length > 0) {
    await db
      .update(communityPosts)
      .set({
        helpfulCount: sql`${communityPosts.helpfulCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(communityPosts.id, postId));
  }

  return NextResponse.json({
    postId,
    added: inserted.length > 0,
  });
}
