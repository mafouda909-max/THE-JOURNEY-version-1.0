import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";
import { travelIntelService } from "@/lib/travel-intel";

export const dynamic = "force-dynamic";

function validateQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const query = value.trim();
  if (!query || query.length > 500) return null;
  return query;
}

function guardExpensiveIntel(request: Request): NextResponse | null {
  const denied = requireAdmin(request);
  if (denied) return denied;

  // Cost-governance fallback. This is process-local; provider-side quotas remain
  // the hard external ceiling in multi-instance/serverless deployments.
  const limit = rateLimiter.checkRateLimit(
    `intel:${clientIpFromRequest(request)}`,
    10,
    60,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "تم بلوغ الحد المؤقت لطلبات البحث الذكي." },
      { status: 429, headers: { "Retry-After": String(limit.resetSeconds) } },
    );
  }
  return null;
}

export async function GET(request: Request) {
  const denied = guardExpensiveIntel(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const query = validateQuery(searchParams.get("q"));
  if (!query) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required and must be at most 500 characters." },
      { status: 400 },
    );
  }

  const result = await travelIntelService.queryTravelIntel(query);
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const denied = guardExpensiveIntel(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const record = (body ?? {}) as Record<string, unknown>;
  const query = validateQuery(record.question ?? record.q);
  if (!query) {
    return NextResponse.json(
      { error: "Question is required and must be at most 500 characters." },
      { status: 400 },
    );
  }

  const result = await travelIntelService.queryTravelIntel(query);
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
