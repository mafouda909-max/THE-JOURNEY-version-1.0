import { NextResponse } from "next/server";
import { resolveAuthOriginForRequest } from "@/lib/auth-origin";
import { SITE_ORIGIN } from "@/lib/site";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";
import { passwordPolicyError, PasswordCapacityError } from "@/lib/password-credentials";
import { InvalidRecoveryTokenError, resetPasswordWithToken } from "@/lib/password-recovery";
import { sessionCookie } from "@/lib/identity";
import { passwordAuthReadiness } from "@/lib/password-auth";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const origin = resolveAuthOriginForRequest(request.url, SITE_ORIGIN);
  if (!origin || request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "ابدأ الاستعادة من موقع صلة." }, { status: 403, headers: NO_STORE });
  }
  if (!(await passwordAuthReadiness.probe())) {
    return NextResponse.json({ error: "استعادة كلمة المرور غير متاحة مؤقتًا." }, { status: 503, headers: NO_STORE });
  }

  const burst = rateLimiter.checkRateLimit(`auth:reset:ip:${clientIpFromRequest(request)}`, 12, 900);
  if (!burst.allowed) {
    return NextResponse.json({ error: "محاولات كثيرة — حاول بعد قليل." }, { status: 429, headers: { ...NO_STORE, "Retry-After": String(burst.resetSeconds) } });
  }
  let body: { token?: unknown; password?: unknown };
  try {
    if (!request.headers.get("content-type")?.includes("application/json") || Number(request.headers.get("content-length") ?? 0) > 4096) throw new Error();
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات الطلب غير صالحة." }, { status: 400, headers: NO_STORE });
  }
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  const policyError = passwordPolicyError(password);
  if (policyError) return NextResponse.json({ error: policyError }, { status: 422, headers: NO_STORE });

  try {
    const result = await resetPasswordWithToken(token, password);
    const response = NextResponse.json({ ok: true, destination: result.destination }, { headers: NO_STORE });
    const cookie = sessionCookie(result.sessionToken);
    response.cookies.set(cookie.name, cookie.value, cookie);
    return response;
  } catch (error) {
    if (error instanceof InvalidRecoveryTokenError) {
      return NextResponse.json({ error: "رابط الاستعادة غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا." }, { status: 400, headers: NO_STORE });
    }
    if (error instanceof PasswordCapacityError) {
      return NextResponse.json({ error: "الخدمة مشغولة الآن — حاول بعد قليل." }, { status: 429, headers: NO_STORE });
    }
    return NextResponse.json({ error: "تعذر تغيير كلمة المرور الآن. حاول بعد قليل." }, { status: 503, headers: NO_STORE });
  }
}
