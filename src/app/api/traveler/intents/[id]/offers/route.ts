import { NextResponse } from "next/server";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { agents, offers, travelerIntentOffers, travelerSavedIntents } from "@/db/schema";
import { accountFromRequest, requireAccount } from "@/lib/identity";

export const dynamic = "force-dynamic";

function positiveId(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isSafeInteger(parsed) && Number(parsed) > 0 ? Number(parsed) : null;
}

async function ownedIntent(intentId: number, accountId: number) {
  const rows = await db
    .select({ id: travelerSavedIntents.id })
    .from(travelerSavedIntents)
    .where(and(
      eq(travelerSavedIntents.id, intentId),
      eq(travelerSavedIntents.accountId, accountId),
      eq(travelerSavedIntents.status, "active"),
    ))
    .limit(1);
  return rows[0] ?? null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.TRAVELER_WORKSPACE_ENABLED !== "true") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const account = await accountFromRequest(request);
  const denied = requireAccount(account, ["traveler"]);
  if (denied) return denied;

  const intentId = positiveId((await params).id);
  if (!intentId || !(await ownedIntent(intentId, account!.id))) {
    return NextResponse.json({ error: "Saved intent not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const offerId = positiveId((body as Record<string, unknown> | null)?.offerId);
  if (!offerId) return NextResponse.json({ error: "Offer id is invalid." }, { status: 422 });

  const now = new Date();
  const available = await db
    .select({ id: offers.id })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(and(
      eq(offers.id, offerId),
      eq(offers.status, "published"),
      eq(agents.verificationStatus, "verified"),
      or(isNull(offers.expiresAt), gt(offers.expiresAt, now)),
    ))
    .limit(1);
  if (!available[0]) {
    return NextResponse.json({ error: "هذا العرض لم يعد متاحاً للمقارنة." }, { status: 404 });
  }

  const selected = await db
    .select({ offerId: travelerIntentOffers.offerId })
    .from(travelerIntentOffers)
    .where(eq(travelerIntentOffers.savedIntentId, intentId));
  if (!selected.some((row) => row.offerId === offerId) && selected.length >= 4) {
    return NextResponse.json({ error: "يمكن مقارنة أربعة عروض كحد أقصى لكل نية سفر." }, { status: 422 });
  }

  await db.transaction(async (tx) => {
    await tx.insert(travelerIntentOffers).values({
      savedIntentId: intentId,
      offerId,
      position: selected.length,
    }).onConflictDoNothing();
    await tx.update(travelerSavedIntents)
      .set({ updatedAt: new Date() })
      .where(eq(travelerSavedIntents.id, intentId));
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.TRAVELER_WORKSPACE_ENABLED !== "true") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const account = await accountFromRequest(request);
  const denied = requireAccount(account, ["traveler"]);
  if (denied) return denied;

  const intentId = positiveId((await params).id);
  const url = new URL(request.url);
  const offerId = positiveId(url.searchParams.get("offerId"));
  if (!intentId || !offerId || !(await ownedIntent(intentId, account!.id))) {
    return NextResponse.json({ error: "Saved intent or offer not found." }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    await tx.delete(travelerIntentOffers).where(and(
      eq(travelerIntentOffers.savedIntentId, intentId),
      eq(travelerIntentOffers.offerId, offerId),
    ));
    await tx.update(travelerSavedIntents)
      .set({ updatedAt: new Date() })
      .where(eq(travelerSavedIntents.id, intentId));
  });
  return NextResponse.json({ ok: true });
}
