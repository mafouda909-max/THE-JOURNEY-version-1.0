import { NextResponse } from "next/server";
import { markQuoteDeliveryViewed } from "@/lib/quote-delivery-public";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

export async function POST(request: Request, context: Context) {
  const { token } = await context.params;
  const ip = clientIpFromRequest(request);
  const limit = rateLimiter.checkRateLimit(`quote-view:${token.slice(0, 8)}:${ip}`, 30, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many view events." },
      { status: 429, headers: { "retry-after": String(limit.resetSeconds), "cache-control": "no-store" } },
    );
  }

  const result = await markQuoteDeliveryViewed(token);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "cache-control": "no-store" },
  });
}
