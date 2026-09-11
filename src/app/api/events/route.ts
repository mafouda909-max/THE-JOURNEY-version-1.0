import { NextResponse } from "next/server";
import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { offers } from "@/db/schema";
import { TRACKABLE_EVENTS, trackEvent, type EventName } from "@/lib/data";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const allowed = new Set<string>(TRACKABLE_EVENTS);
const VIEW_EVENTS = new Set<EventName>(["landing_view", "offer_viewed", "agent_viewed"]);
const MAX_META_CHARS = 1200;
const HUMAN_VIEW_SOURCE = "client_visible_2000ms";
const BOT_UA = /bot|spider|crawler|headless|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp|slackbot|twitterbot|discordbot/i;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function isLikelyBot(request: Request): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  return !ua || BOT_UA.test(ua);
}

function hasHumanViewMarker(meta: string | null): boolean {
  if (!meta) return false;
  try {
    const parsed = JSON.parse(meta) as { source?: unknown };
    return parsed?.source === HUMAN_VIEW_SOURCE;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = rateLimiter.checkRateLimit(`events:${ip}`, 60, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many events — تم تقييد الإرسال مؤقتاً." },
      { status: 429, headers: { "Retry-After": String(rl.resetSeconds) } },
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

  const eventName = name as EventName;
  const parsedOfferId = positiveInteger(offerId);
  const parsedAgentId = positiveInteger(agentId);
  const eventMeta = typeof meta === "string" ? meta : null;

  if (eventName === "offer_viewed" && !parsedOfferId) {
    return NextResponse.json({ error: "offer_viewed requires a valid offer id" }, { status: 422 });
  }
  if (eventName === "agent_viewed" && !parsedAgentId) {
    return NextResponse.json({ error: "agent_viewed requires a valid agent id" }, { status: 422 });
  }

  if (VIEW_EVENTS.has(eventName)) {
    if (isLikelyBot(request) || !hasHumanViewMarker(eventMeta)) {
      return NextResponse.json({ ok: true, counted: false }, { status: 202 });
    }
    const subject = parsedOfferId ?? parsedAgentId ?? "landing";
    const uniqueView = rateLimiter.checkRateLimit(`human-view:${eventName}:${ip}:${subject}`, 1, 600);
    if (!uniqueView.allowed) {
      return NextResponse.json({ ok: true, counted: false }, { status: 202 });
    }
  }

  await trackEvent(eventName, {
    offerId: parsedOfferId,
    agentId: parsedAgentId,
    meta: eventMeta,
  });

  if (eventName === "offer_viewed" && parsedOfferId) {
    try {
      await db
        .update(offers)
        .set({ viewCount: sql`${offers.viewCount} + 1` })
        .where(eq(offers.id, parsedOfferId));
    } catch {
      // Analytics counters are best effort and must not break navigation.
    }
  }

  return NextResponse.json({ ok: true, counted: true }, { status: 201 });
}
