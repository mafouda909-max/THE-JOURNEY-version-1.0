import { NextResponse } from "next/server";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  campaigns,
  contactRequests,
  contentItems,
  experiments,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CONTENT_FLOW: Record<string, string[]> = {
  draft: ["in_review"],
  in_review: ["approved", "draft"],
  approved: ["scheduled", "published"],
  scheduled: ["published", "approved"],
  published: ["measured"],
  measured: [],
};

const DECISIONS = new Set(["keep", "kill", "iterate", "scale"]);

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const [content, camps, exps, attribution, audit] = await Promise.all([
    db.select().from(contentItems).orderBy(desc(contentItems.createdAt)),
    db.select().from(campaigns).orderBy(asc(campaigns.createdAt)),
    db.select().from(experiments).orderBy(desc(experiments.startedAt)),
    db
      .select({
        utmSource: contactRequests.utmSource,
        count: sql<number>`count(*)::int`,
      })
      .from(contactRequests)
      .groupBy(contactRequests.utmSource),
    db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(20),
  ]);

  return NextResponse.json({
    content,
    campaigns: camps,
    experiments: exps,
    auditLog: audit,
    leadsBySource: attribution.map((a) => ({
      source: a.utmSource ?? "مباشر/عضوي",
      count: a.count,
    })),
  });
}

export async function PATCH(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { entity, id, to, decision } = (body ?? {}) as Record<string, unknown>;
  const parsed = Number(id);
  if (!Number.isInteger(parsed)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  if (entity === "content" && typeof to === "string") {
    const [item] = await db
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, parsed))
      .limit(1);
    if (!item) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

    // Risk gate (§7): medium/high-risk items cannot skip human approval
    const allowed = CONTENT_FLOW[item.status] ?? [];
    if (!allowed.includes(to)) {
      return NextResponse.json(
        { error: `الانتقال من «${item.status}» إلى «${to}» غير مسموح في مسار الاعتماد.` },
        { status: 422 },
      );
    }
    if (
      (item.risk === "medium" || item.risk === "high") &&
      item.status === "draft" &&
      to === "approved"
    ) {
      return NextResponse.json(
        { error: "المحتوى المتوسط/العالي الخطورة يحتاج مراجعة بشرية قبل الاعتماد." },
        { status: 422 },
      );
    }

    const [updated] = await db
      .update(contentItems)
      .set({
        status: to,
        ...(to === "published"
          ? { publishedAt: new Date() }
          : to === "scheduled"
            ? { scheduledFor: new Date(Date.now() + 86_400_000) }
            : {}),
      })
      .where(eq(contentItems.id, parsed))
      .returning();
    await db.insert(auditLog).values({
      actor: "growth_admin",
      action: "content_transition",
      targetType: "content",
      targetId: updated.id,
      reason: null,
      prevState: item.status,
      newState: updated.status,
      meta: `channel=${item.channel};risk=${item.risk}`,
    });
    return NextResponse.json({ item: updated });
  }

  if (entity === "experiment") {
    if (typeof decision !== "string" || !DECISIONS.has(decision)) {
      return NextResponse.json(
        { error: "القرار يجب أن يكون: keep / kill / iterate / scale" },
        { status: 422 },
      );
    }
    const [updated] = await db
      .update(experiments)
      .set({ decision, status: "concluded", endedAt: new Date() })
      .where(eq(experiments.id, parsed))
      .returning();
    if (!updated) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    await db.insert(auditLog).values({
      actor: "growth_admin",
      action: "experiment_decision",
      targetType: "experiment",
      targetId: updated.id,
      reason: null,
      prevState: "running",
      newState: decision as string,
      meta: updated.hypothesis.slice(0, 120),
    });
    return NextResponse.json({ experiment: updated });
  }

  return NextResponse.json({ error: "Unknown entity" }, { status: 422 });
}
