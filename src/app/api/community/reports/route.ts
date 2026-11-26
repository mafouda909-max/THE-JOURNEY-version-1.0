import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  communityComments,
  communityPosts,
  communityReports,
} from "@/db/schema";
import { accountFromRequest } from "@/lib/identity";
import { isCommunityEnabled } from "@/lib/community";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const REPORT_CATEGORIES = [
  "spam",
  "misinformation",
  "harassment",
  "privacy",
  "unsafe",
  "other",
] as const;

function positiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function POST(request: Request) {
  if (!isCommunityEnabled()) {
    return NextResponse.json({ error: "المجتمع غير مفعّل في هذه البيئة." }, { status: 503, headers: NO_STORE });
  }

  const account = await accountFromRequest(request);
  if (!account) {
    return NextResponse.json({ error: "سجّل الدخول أولاً لإرسال بلاغ." }, { status: 401, headers: NO_STORE });
  }

  const throttle = rateLimiter.checkRateLimit("community-report:" + account.id, 5, 3600);
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "وصلت إلى الحد المؤقت للبلاغات. أعد المحاولة لاحقاً." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(throttle.resetSeconds) } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: NO_STORE });
  }

  const data = (payload ?? {}) as Record<string, unknown>;
  const targetType = data.targetType;
  const targetId = positiveId(data.targetId);
  const category = typeof data.category === "string" ? data.category : "";
  const details = typeof data.details === "string" ? data.details.trim() : "";

  if ((targetType !== "post" && targetType !== "comment") || !targetId) {
    return NextResponse.json({ error: "نوع المحتوى أو رقمه غير صحيح." }, { status: 422, headers: NO_STORE });
  }
  if (!(REPORT_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: "اختر سبباً صحيحاً للبلاغ." }, { status: 422, headers: NO_STORE });
  }
  if (details.length > 500) {
    return NextResponse.json({ error: "التفاصيل يجب ألا تتجاوز 500 حرف." }, { status: 422, headers: NO_STORE });
  }

  let postId: number | null = null;
  let commentId: number | null = null;

  if (targetType === "post") {
    const [post] = await db
      .select({ id: communityPosts.id })
      .from(communityPosts)
      .where(and(eq(communityPosts.id, targetId), eq(communityPosts.status, "published")))
      .limit(1);
    if (!post) {
      return NextResponse.json({ error: "المشاركة غير متاحة للبلاغ." }, { status: 404, headers: NO_STORE });
    }
    postId = post.id;
  } else {
    const [comment] = await db
      .select({
        id: communityComments.id,
        postId: communityComments.postId,
      })
      .from(communityComments)
      .innerJoin(communityPosts, eq(communityPosts.id, communityComments.postId))
      .where(
        and(
          eq(communityComments.id, targetId),
          eq(communityComments.status, "published"),
          eq(communityPosts.status, "published"),
        ),
      )
      .limit(1);
    if (!comment) {
      return NextResponse.json({ error: "التعليق غير متاح للبلاغ." }, { status: 404, headers: NO_STORE });
    }
    commentId = comment.id;
  }

  const created = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(communityReports)
      .values({
        reporterAccountId: account.id,
        targetType,
        postId,
        commentId,
        category,
        details: details || null,
        status: "pending_review",
      })
      .onConflictDoNothing()
      .returning({ id: communityReports.id });

    const report = rows[0];
    if (!report) return null;

    await tx.insert(auditLog).values({
      actor: "account:" + account.id,
      action: "community_content_reported",
      targetType: "community_report",
      targetId: report.id,
      reason: targetType + ":" + targetId + "; category=" + category,
    });

    return report;
  });

  if (!created) {
    return NextResponse.json(
      { error: "سبق أن أرسلت بلاغاً عن هذا المحتوى." },
      { status: 409, headers: NO_STORE },
    );
  }

  return NextResponse.json(
    {
      id: created.id,
      status: "pending_review",
      message: "وصل البلاغ للمراجعة. تفاصيله لا تظهر للآخرين.",
    },
    { status: 201, headers: NO_STORE },
  );
}
