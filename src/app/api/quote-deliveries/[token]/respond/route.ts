import { NextResponse } from "next/server";
import { respondToQuoteDelivery } from "@/lib/quote-delivery-service";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };
type Json = Record<string, unknown>;

async function parseBody(request: Request): Promise<Json | null> {
  try {
    const value: unknown = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Json : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request, context: Context) {
  const { token } = await context.params;
  const ip = clientIpFromRequest(request);
  const limit = rateLimiter.checkRateLimit(`quote-response:${token.slice(0, 8)}:${ip}`, 10, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many response attempts." },
      { status: 429, headers: { "retry-after": String(limit.resetSeconds), "cache-control": "no-store" } },
    );
  }

  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const result = await respondToQuoteDelivery(token, { response: body.response, message: body.message });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "cache-control": "no-store" },
  });
}
