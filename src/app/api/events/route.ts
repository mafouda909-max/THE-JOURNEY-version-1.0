import { NextResponse } from "next/server";
import { TRACKABLE_EVENTS, trackEvent, type EventName } from "@/lib/data";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const allowed = new Set<string>(TRACKABLE_EVENTS);
const MAX_META_CHARS = 1200;

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(request: Request) {
  const rl = rateLimiter.checkRateLimit(`events:${clientIp(request)}`, 60, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many events — تم تقييد الإرسال مؤقتاً." },
      { status: 429 },
    );
  }

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
  if (meta !== undefined && meta !== null && typeof meta !== "string") {
    return NextResponse.json({ error: "Invalid event metadata" }, { status: 422 });
  }
  if (typeof meta === "string" && meta.length > MAX_META_CHARS) {
    return NextResponse.json({ error: "Event metadata is too large" }, { status: 413 });
  }

  await trackEvent(name as EventName, {
    offerId: positiveInteger(offerId),
    agentId: positiveInteger(agentId),
    meta: typeof meta === "string" ? meta : null,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
