import { NextResponse } from "next/server";
import { recordTravelerDirectConfirmationResponse } from "@/lib/quote-delivery-public";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

export async function POST(request: Request, context: Context) {
  if (process.env.DIRECT_CONFIRMATION_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { token } = await context.params;
  const ip = clientIpFromRequest(request);
  const limit = rateLimiter.checkRateLimit(
    `quote-direct-response:${token.slice(0, 8)}:${ip}`,
    5,
    3600,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "محاولات كثيرة في وقت قصير. حاول لاحقًا." },
      { status: 429, headers: { "Retry-After": String(limit.resetSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid response body." }, { status: 422 });
  }

  const input = body as Record<string, unknown>;
  const result = await recordTravelerDirectConfirmationResponse(token, {
    response: input.response,
    message: input.message,
  });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "cache-control": "no-store" },
  });
}
