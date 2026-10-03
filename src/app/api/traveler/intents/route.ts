import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { travelerSavedIntents } from "@/db/schema";
import { accountFromRequest, requireAccount } from "@/lib/identity";
import { parseTravelerIntent } from "@/lib/commercial-domain";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.TRAVELER_WORKSPACE_ENABLED !== "true") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const account = await accountFromRequest(request);
  const denied = requireAccount(account, ["traveler"]);
  if (denied) return denied;

  const rows = await db
    .select()
    .from(travelerSavedIntents)
    .where(eq(travelerSavedIntents.accountId, account!.id))
    .orderBy(desc(travelerSavedIntents.updatedAt))
    .limit(50);

  return NextResponse.json({ intents: rows });
}

export async function POST(request: Request) {
  if (process.env.TRAVELER_WORKSPACE_ENABLED !== "true") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const account = await accountFromRequest(request);
  const denied = requireAccount(account, ["traveler"]);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const parsed = parseTravelerIntent(input.intent);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 422 });
  }

  const rawLabel = typeof input.label === "string" ? input.label.trim() : "";
  const fallback = parsed.value.destinations[0]
    ? `رحلة إلى ${parsed.value.destinations[0]}`
    : "رحلة محفوظة";
  const label = (rawLabel || fallback).slice(0, 120);

  const [created] = await db
    .insert(travelerSavedIntents)
    .values({
      accountId: account!.id,
      label,
      intentSnapshot: parsed.value,
      status: "active",
      updatedAt: new Date(),
    })
    .returning();

  return NextResponse.json({ intent: created }, { status: 201 });
}
