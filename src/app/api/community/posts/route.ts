import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLog, communityPosts } from "@/db/schema";
import { accountFromRequest } from "@/lib/identity";
import {
  COMMUNITY_POST_TYPES,
  isCommunityEnabled,
  listPublishedCommunityPosts,
  type CommunityPostType,
} from "@/lib/community";
import { redTeamSecurityEngine } from "@/lib/redteam";

export const dynamic = "force-dynamic";

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET(request: Request) {
  if (!isCommunityEnabled()) {
    return NextResponse.json({ enabled: false, count: 0, posts: [] });
  }

  const { searchParams } = new URL(request.url);
  const destinationCountry = clean(searchParams.get("destination"), 80) || undefined;
  const posts = await listPublishedCommunityPosts({
    limit: 30,
    destinationCountry,
  });

  return NextResponse.json({
    enabled: true,
    count: posts.length,
    posts,
  });
}

export async function POST(request: Request) {
  if (!isCommunityEnabled()) {
    return NextResponse.json(
      { error: "المجتمع لم يُفعّل في هذه البيئة بعد." },
      { status: 503 },
    );
  }

  const account = await accountFromRequest(request);
  if (!account) {
    return NextResponse.json(
      { error: "سجّل الدخول أولاً للمشاركة في المجتمع." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = (body ?? {}) as Record<string, unknown>;
  const type = clean(data.type, 20) as CommunityPostType;
  const allowed = new Set(COMMUNITY_POST_TYPES.map((item) => item.key));
  const title = clean(data.title, 180);
  const content = clean(data.body, 4000);
  const destinationCountry = clean(data.destinationCountry, 80) || null;
  const destinationCity = clean(data.destinationCity, 80) || null;
  const topic = clean(data.topic, 64) || null;

  if (!allowed.has(type)) {
    return NextResponse.json({ error: "نوع المشاركة غير صالح." }, { status: 422 });
  }
  if (title.length < 10) {
    return NextResponse.json(
      { error: "اكتب عنواناً أوضح للمشاركة (10 أحرف على الأقل)." },
      { status: 422 },
    );
  }
  if (content.length < 20) {
    return NextResponse.json(
      { error: "المحتوى قصير جدًا. أضف تفاصيل تساعد المجتمع." },
      { status: 422 },
    );
  }

  const scan = redTeamSecurityEngine.scanContentForFraud(`${title}\n${content}`);
  const inserted = await db
    .insert(communityPosts)
    .values({
      authorAccountId: account.id,
      type,
      title,
      body: content,
      destinationCountry,
      destinationCity,
      topic,
      status: "pending_review",
      updatedAt: new Date(),
    })
    .returning({ id: communityPosts.id });

  const id = inserted[0]?.id;
  if (!id) {
    return NextResponse.json({ error: "تعذر حفظ المشاركة." }, { status: 500 });
  }

  await db.insert(auditLog).values({
    actor: `account:${account.id}`,
    action: "community_post_submitted",
    targetType: "community_post",
    targetId: id,
    reason: `type=${type}; moderation=pending_review`,
  });

  if (scan.isSuspicious) {
    await redTeamSecurityEngine.logFraudCase("community_post", id, scan);
  }

  return NextResponse.json(
    {
      id,
      status: "pending_review",
      message: "وصلت مشاركتك للمراجعة. لن تظهر للعامة قبل اعتمادها.",
    },
    { status: 202 },
  );
}
