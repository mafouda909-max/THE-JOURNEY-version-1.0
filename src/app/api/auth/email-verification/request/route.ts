import { NextResponse } from "next/server";
import { accountFromRequest } from "@/lib/identity";
import { resolveAuthOriginForRequest } from "@/lib/auth-origin";
import { SITE_ORIGIN } from "@/lib/site";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";
import {
  recoveryMailReady,
  requestEmailVerification,
  RecoveryMailUnavailableError,
} from "@/lib/password-recovery";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const origin = resolveAuthOriginForRequest(request.url, SITE_ORIGIN);
  if (!origin || request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "ابدأ التحقق من حسابك في صلة." }, { status: 403, headers: NO_STORE });
  }

  const account = await accountFromRequest(request);
  if (!account || !["traveler", "agent"].includes(account.role)) {
    return NextResponse.json({ error: "سجّل الدخول أولًا." }, { status: 401, headers: NO_STORE });
  }

  const limit = rateLimiter.checkRateLimit(
    `auth:verify-email:${account.id}:${clientIpFromRequest(request)}`,
    6,
    3600,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "طلبات كثيرة — حاول لاحقًا." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(limit.resetSeconds) } },
    );
  }

  if (!(await recoveryMailReady())) {
    return NextResponse.json({ error: "خدمة البريد غير جاهزة مؤقتًا." }, { status: 503, headers: NO_STORE });
  }

  try {
    const state = await requestEmailVerification(account.id, account.email, origin);
    return NextResponse.json({
      ok: true,
      message: state === "already" ? "بريدك موثّق بالفعل." : "أرسلنا رابط تأكيد إلى بريد حسابك.",
    }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof RecoveryMailUnavailableError) {
      return NextResponse.json({ error: "تعذر إرسال رسالة التأكيد الآن." }, { status: 503, headers: NO_STORE });
    }
    return NextResponse.json({ error: "تعذر بدء التحقق الآن." }, { status: 503, headers: NO_STORE });
  }
}
