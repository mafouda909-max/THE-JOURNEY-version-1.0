import { readAuthBody } from "@/lib/auth-request";
import { passwordBudget } from "@/lib/password-budget";
import { NextResponse } from "next/server";
import { resolveAuthOriginForRequest } from "@/lib/auth-origin";
import { SITE_ORIGIN } from "@/lib/site";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";
import { verifyEmailWithToken, validRecoveryToken } from "@/lib/password-recovery";
import { passwordAuthReadiness } from "@/lib/password-auth";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const origin = resolveAuthOriginForRequest(request.url, SITE_ORIGIN);
  if (!origin || request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "افتح رابط التحقق من موقع صلة." }, { status: 403, headers: NO_STORE });
  }

  if (!(await passwordAuthReadiness.probe())) {
    return NextResponse.json({ error: "تأكيد البريد غير متاح مؤقتًا." }, { status: 503, headers: NO_STORE });
  }

  const limit = rateLimiter.checkRateLimit(
    `auth:verify-confirm:${clientIpFromRequest(request)}`,
    20,
    900,
  );
  if (!limit.allowed) {
    return NextResponse.json({ error: "محاولات كثيرة — حاول لاحقًا." }, { status: 429, headers: NO_STORE });
  }

  let token = "";
  try {
    const body = await readAuthBody(request);
    token = typeof body.token === "string" ? body.token : "";
  } catch (error) {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: error instanceof RangeError ? 413 : 400, headers: NO_STORE });
  }

  if (!validRecoveryToken(token)) return NextResponse.json({ error: "رابط التحقق غير صالح أو انتهت صلاحيته." }, { status: 400, headers: NO_STORE });
  let ok: boolean;
  try {
    const budget = await passwordBudget.consume("confirm", clientIpFromRequest(request), token);
    if (!budget.allowed) return NextResponse.json({ error: "محاولات كثيرة — حاول لاحقًا." }, { status: 429, headers: { ...NO_STORE, "Retry-After": String(budget.retry) } });
    ok = await verifyEmailWithToken(token);
  } catch {
    return NextResponse.json({ error: "تعذر تأكيد البريد الآن. حاول بعد قليل." }, { status: 503, headers: NO_STORE });
  }
  if (!ok) {
    return NextResponse.json(
      { error: "رابط التحقق غير صالح أو انتهت صلاحيته." },
      { status: 400, headers: NO_STORE },
    );
  }
  return NextResponse.json({ ok: true, message: "تم تأكيد بريدك بنجاح." }, { headers: NO_STORE });
}
