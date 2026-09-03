import { NextResponse } from "next/server";
import { TRACKABLE_EVENTS, trackEvent, type EventName } from "@/lib/data";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const allowed = new Set<string>(TRACKABLE_EVENTS);

// Abuse throttle. NOTE: this bucket is process-local (in-memory) and is safe for
// a single-instance serverless/runtime topology. On multi-instance deployments
// each instance maintains its own bucket, so it is NOT a global distributed
// cap — it should be replaced by a shared store (e.g. Redis) for hard limits.
function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
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

  await trackEvent(name as EventName, {
    offerId: Number.isInteger(Number(offerId)) ? Number(offerId) : null,
    agentId: Number.isInteger(Number(agentId)) ? Number(agentId) : null,
    meta: typeof meta === "string" ? meta : null,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
