import { NextResponse } from "next/server";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";
import { travelWebProvider } from "@/lib/providers/web";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const limit = rateLimiter.checkRateLimit(`preview-web-probe:${clientIpFromRequest(request)}`, 2, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(limit.resetSeconds) } });
  }
  const result = await travelWebProvider.probe(request.signal);
  return NextResponse.json({
    status: result.status,
    latencyMs: result.latencyMs,
    providerName: result.providerName ?? null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
