import { NextResponse } from "next/server";
import { recoveryDispatch } from "@/lib/recovery-dispatch";
import { resolveAuthOriginForRequest } from "@/lib/auth-origin";
import { SITE_ORIGIN } from "@/lib/site";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";
import { recoveryMailReady, requestPasswordReset } from "@/lib/password-recovery";
import { passwordAuthReadiness } from "@/lib/password-auth";
import { readAuthBody } from "@/lib/auth-request";
import { normalizeAuthEmail } from "@/lib/passwordless-auth";
import { passwordBudget } from "@/lib/password-budget";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const origin = resolveAuthOriginForRequest(request.url, SITE_ORIGIN);
  if (!origin || request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "ابدأ الاستعادة من موقع صلة." }, { status: 403, headers: NO_STORE });
  }
  const burst = rateLimiter.checkRateLimit(`auth:recovery:ip:${clientIpFromRequest(request)}`, 8, 900);
  if (!burst.allowed) return NextResponse.json({ error: "محاولات كثيرة — حاول بعد قليل." }, { status: 429, headers: { ...NO_STORE, "Retry-After": String(burst.resetSeconds) } });

  let email: string | null;
  try { email = normalizeAuthEmail((await readAuthBody(request, 2048)).email); }
  catch (error) { return NextResponse.json({ error: "بيانات الطلب غير صالحة." }, { status: error instanceof RangeError ? 413 : 400, headers: NO_STORE }); }
  if (!email) return NextResponse.json({ error: "اكتب بريدًا إلكترونيًا صحيحًا." }, { status: 422, headers: NO_STORE });

  try {
    // These checks never look up an account. Mail dispatch happens after the
    // response, so absent accounts and recipient-specific failures look alike.
    if (!await passwordAuthReadiness.probe() || !await recoveryMailReady()) {
      return NextResponse.json({ error: "خدمة استعادة الحساب بالبريد غير جاهزة مؤقتًا." }, { status: 503, headers: NO_STORE });
    }
    const budget = await passwordBudget.consume("recovery", clientIpFromRequest(request), email);
    if (!budget.allowed) return NextResponse.json({ error: "محاولات كثيرة — حاول بعد قليل." }, { status: 429, headers: { ...NO_STORE, "Retry-After": String(budget.retry) } });
    recoveryDispatch.schedule(() => requestPasswordReset(email, origin));
    return NextResponse.json({ ok: true, message: "تم قبول طلب الاستعادة. إذا كان البريد مرتبطًا بحساب صالح وكانت خدمة البريد متاحة، فستصلك رسالة برابط الاستعادة." }, { status: 202, headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "تعذر إكمال طلب الاستعادة الآن. حاول بعد قليل." }, { status: 503, headers: NO_STORE });
  }
}
