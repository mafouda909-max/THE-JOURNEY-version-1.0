import { NextResponse } from "next/server";
import { TRACKABLE_EVENTS, trackEvent, type EventName } from "@/lib/data";

export const dynamic = "force-dynamic";

const allowed = new Set<string>(TRACKABLE_EVENTS);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, offerId, agentId, meta } = (body ?? {}) as Record<string, unknown>;
  if (typeof name !== "string" || !allowed.has(name)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 422 });
  }

  await trackEvent(name as EventName, {
    offerId: Number.isInteger(Number(offerId)) ? Number(offerId) : null,
    agentId: Number.isInteger(Number(agentId)) ? Number(agentId) : null,
    meta: typeof meta === "string" ? meta : null,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
