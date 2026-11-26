import { NextResponse } from "next/server";
import { accountFromRequest } from "@/lib/identity";
import { respondToTravelerQuoteDelivery } from "@/lib/quote-delivery-public";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; deliveryId: string }> };

export async function POST(request: Request, context: Context) {
  if (process.env.MULTI_PROVIDER_REQUESTS_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const account = await accountFromRequest(request);
  if (!account || account.role !== "traveler") {
    return NextResponse.json({ error: "سجّل الدخول بحساب المسافر أولًا." }, { status: 401 });
  }

  const { id, deliveryId } = await context.params;
  const ip = clientIpFromRequest(request);
  const limit = rateLimiter.checkRateLimit(
    `traveler-marketplace-quote:${account.id}:${ip}`,
    12,
    3600,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "تم تجاوز عدد محاولات الرد المسموح مؤقتًا." },
      { status: 429, headers: { "Retry-After": String(limit.resetSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات الرد غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "بيانات الرد غير صالحة." }, { status: 422 });
  }
  const input = body as Record<string, unknown>;
  const result = await respondToTravelerQuoteDelivery(id, deliveryId, account.id, {
    response: input.response,
    message: input.message,
  });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "cache-control": "no-store" },
  });
}
