import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  auditLog,
  communityComments,
  communityPosts,
} from "@/db/schema";
import { accountFromRequest } from "@/lib/identity";
import { isCommunityEnabled } from "@/lib/community";
import { redTeamSecurityEngine } from "@/lib/redteam";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function parsePostId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isCommunityEnabled()) {
    return NextResponse.json({ error: "Community disabled" }, { status: 503, headers: NO_STORE });
  }

  const { id } = await params;
  const postId = parsePostId(id);
  if (!postId) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400, headers: NO_STORE });
  }

  const [post] = await db
    .select({ id: communityPosts.id })
    .from(communityPosts)
    .where(and(eq(communityPosts.id, postId), eq(communityPosts.status, "published")))
    .limit(1);

  if (!post) {
    return NextResponse.json({ error: "المشاركة غير متاحة." }, { status: 404, headers: NO_STORE });
  }

  const rows = await db
    .select({
      id: communityComments.id,
      parentCommentId: communityComments.parentCommentId,
      body: communityComments.body,
      createdAt: communityComments.createdAt,
      author: {
        displayName: accounts.displayName,
        role: accounts.role,
      },
    })
    .from(communityComments)
    .innerJoin(accounts, eq(accounts.id, communityComments.authorAccountId))
    .where(
      and(
        eq(communityComments.postId, postId),
        eq(communityComments.status, "published"),
      ),
    )
    .orderBy(asc(communityComments.createdAt), asc(communityComments.id))
    .limit(200);

  const publishedIds = new Set(rows.map((row) => row.id));
  const comments = rows
    .filter((row) => row.parentCommentId === null || publishedIds.has(row.parentCommentId))
    .map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));

  return NextResponse.json({ postId, comments }, { headers: NO_STORE });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isCommunityEnabled()) {
    return NextResponse.json({ error: "المجتمع غير مفعّل في هذه البيئة." }, { status: 503, headers: NO_STORE });
  }

  const account = await accountFromRequest(request);
  if (!account) {
    return NextResponse.json({ error: "سجّل الدخول أولاً لإضافة تعليق." }, { status: 401, headers: NO_STORE });
  }

  const throttle = rateLimiter.checkRateLimit("community-comment:" + account.id, 12, 3600);
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "وصلت للحد المؤقت من التعليقات. أعد المحاولة لاحقاً." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(throttle.resetSeconds) } },
    );
  }

  const { id } = await params;
  const postId = parsePostId(id);
  if (!postId) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400, headers: NO_STORE });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: NO_STORE });
  }

  const data = (payload ?? {}) as Record<string, unknown>;
  const content = typeof data.body === "string" ? data.body.trim() : "";
  if (content.length < 10 || content.length > 2000) {
    return NextResponse.json(
      { error: "اكتب تعليقاً مفيداً من 10 إلى 2000 حرف." },
      { status: 422, headers: NO_STORE },
    );
  }

  let parentCommentId: number | null = null;
  if (data.parentCommentId !== undefined && data.parentCommentId !== null) {
    const candidate = Number(data.parentCommentId);
    if (!Number.isSafeInteger(candidate) || candidate < 1) {
      return NextResponse.json({ error: "Invalid parent comment id" }, { status: 422, headers: NO_STORE });
    }
    parentCommentId = candidate;
  }

  const [post] = await db
    .select({ id: communityPosts.id })
    .from(communityPosts)
    .where(and(eq(communityPosts.id, postId), eq(communityPosts.status, "published")))
    .limit(1);

  if (!post) {
    return NextResponse.json({ error: "المشاركة غير متاحة." }, { status: 404, headers: NO_STORE });
  }

  if (parentCommentId !== null) {
    const [parent] = await db
      .select({
        id: communityComments.id,
        parentCommentId: communityComments.parentCommentId,
      })
      .from(communityComments)
      .where(
        and(
          eq(communityComments.id, parentCommentId),
          eq(communityComments.postId, postId),
          eq(communityComments.status, "published"),
        ),
      )
      .limit(1);

    if (!parent) {
      return NextResponse.json({ error: "التعليق الأصلي غير متاح للرد." }, { status: 404, headers: NO_STORE });
    }
    if (parent.parentCommentId !== null) {
      return NextResponse.json({ error: "الردود تكون على التعليق الأصلي فقط." }, { status: 422, headers: NO_STORE });
    }
  }

  const scan = redTeamSecurityEngine.scanContentForFraud(content);
  const inserted = await db
    .insert(communityComments)
    .values({
      postId,
      authorAccountId: account.id,
      parentCommentId,
      body: content,
      status: "pending_review",
    })
    .returning({ id: communityComments.id });

  const commentId = inserted[0]?.id;
  if (!commentId) {
    return NextResponse.json({ error: "تعذر حفظ التعليق." }, { status: 500, headers: NO_STORE });
  }

  await db.insert(auditLog).values({
    actor: "account:" + account.id,
    action: "community_comment_submitted",
    targetType: "community_comment",
    targetId: commentId,
    reason: "post_id=" + postId + "; parent_comment_id=" + (parentCommentId ?? "root") + "; moderation=pending_review",
  });

  if (scan.isSuspicious) {
    await redTeamSecurityEngine.logFraudCase("community_comment", commentId, scan);
  }

  return NextResponse.json(
    {
      id: commentId,
      postId,
      parentCommentId,
      status: "pending_review",
      message: "وصل تعليقك للمراجعة. سيظهر بعد اعتماده.",
    },
    { status: 202, headers: NO_STORE },
  );
}
