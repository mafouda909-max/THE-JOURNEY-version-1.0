import { NextResponse } from "next/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
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
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  if (entity === "content" && typeof to === "string") {
    const outcome = await db.transaction(async (tx) => {
      const [item] = await tx
        .select()
        .from(contentItems)
        .where(eq(contentItems.id, parsed))
        .limit(1);
      if (!item) return { kind: "missing" } as const;

      const allowed = CONTENT_FLOW[item.status] ?? [];
      if (!allowed.includes(to)) {
        return { kind: "invalid_transition", from: item.status } as const;
      }

      // Medium/high-risk content must pass the explicit human-review state.
      // This guard remains fail-closed if the flow is expanded later.
      if (
        (item.risk === "medium" || item.risk === "high") &&
        item.status === "draft" &&
        to === "approved"
      ) {
        return { kind: "review_required" } as const;
      }

      const [updated] = await tx
        .update(contentItems)
        .set({
          status: to,
          ...(to === "published"
            ? { publishedAt: new Date() }
            : to === "scheduled"
              ? { scheduledFor: new Date(Date.now() + 86_400_000) }
              : {}),
        })
        .where(and(eq(contentItems.id, parsed), eq(contentItems.status, item.status)))
        .returning();
      if (!updated) return { kind: "conflict" } as const;

      await tx.insert(auditLog).values({
        actor: "growth_admin",
        action: "content_transition",
        targetType: "content",
        targetId: updated.id,
        reason: null,
        prevState: item.status,
        newState: updated.status,
        meta: `channel=${item.channel};risk=${item.risk}`,
      });
      return { kind: "updated", item: updated } as const;
    });

    if (outcome.kind === "missing") {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }
    if (outcome.kind === "invalid_transition") {
      return NextResponse.json(
        { error: `الانتقال من «${outcome.from}» إلى «${to}» غير مسموح في مسار الاعتماد.` },
        { status: 422 },
      );
    }
    if (outcome.kind === "review_required") {
      return NextResponse.json(
        { error: "المحتوى المتوسط/العالي الخطورة يحتاج مراجعة بشرية قبل الاعتماد." },
        { status: 422 },
      );
    }
    if (outcome.kind === "conflict") {
      return NextResponse.json(
        { error: "تغيّرت حالة المحتوى أثناء تنفيذ القرار. حدّث اللوحة وحاول مرة أخرى." },
        { status: 409 },
      );
    }
    return NextResponse.json({ item: outcome.item });
  }

  if (entity === "experiment") {
    if (typeof decision !== "string" || !DECISIONS.has(decision)) {
      return NextResponse.json(
        { error: "القرار يجب أن يكون: keep / kill / iterate / scale" },
        { status: 422 },
      );
    }

    const outcome = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(experiments)
        .where(eq(experiments.id, parsed))
        .limit(1);
      if (!current) return { kind: "missing" } as const;
      if (current.status !== "running") {
        return { kind: "already_concluded", status: current.status, decision: current.decision } as const;
      }

      const [updated] = await tx
        .update(experiments)
        .set({ decision, status: "concluded", endedAt: new Date() })
        .where(and(eq(experiments.id, parsed), eq(experiments.status, "running")))
        .returning();
      if (!updated) return { kind: "conflict" } as const;

      await tx.insert(auditLog).values({
        actor: "growth_admin",
        action: "experiment_decision",
        targetType: "experiment",
        targetId: updated.id,
        reason: null,
        prevState: current.status,
        newState: decision,
        meta: updated.hypothesis.slice(0, 120),
      });
      return { kind: "updated", experiment: updated } as const;
    });

    if (outcome.kind === "missing") {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }
    if (outcome.kind === "already_concluded") {
      return NextResponse.json(
        { error: "هذه التجربة أُغلقت بالفعل. حدّث اللوحة قبل اتخاذ قرار جديد." },
        { status: 409 },
      );
    }
    if (outcome.kind === "conflict") {
      return NextResponse.json(
        { error: "تغيّرت حالة التجربة أثناء تنفيذ القرار. حدّث اللوحة وحاول مرة أخرى." },
        { status: 409 },
      );
    }
    return NextResponse.json({ experiment: outcome.experiment });
  }

  return NextResponse.json({ error: "Unknown entity" }, { status: 422 });
}
