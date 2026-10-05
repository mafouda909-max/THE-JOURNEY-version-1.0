import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, sessions } from "@/db/schema";
import { accountFromRequest, createSession, sessionCookie } from "@/lib/identity";
import { resolveAuthOriginForRequest } from "@/lib/auth-origin";
import { SITE_ORIGIN } from "@/lib/site";
import {
  hashPilotPassword,
  passwordPolicyError,
  PasswordCapacityError,
  pilotPasswordHash,
  verifyPilotPassword,
} from "@/lib/password-credentials";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";
import { passwordAuthReadiness } from "@/lib/password-auth";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const origin = resolveAuthOriginForRequest(request.url, SITE_ORIGIN);
  if (!origin || request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "ابدأ تغيير كلمة المرور من حسابك في صلة." }, { status: 403, headers: NO_STORE });
  }

  if (!(await passwordAuthReadiness.probe())) {
    return NextResponse.json({ error: "إدارة كلمة المرور غير متاحة مؤقتًا." }, { status: 503, headers: NO_STORE });
  }

  const account = await accountFromRequest(request);
  if (!account) return NextResponse.json({ error: "سجّل الدخول أولًا." }, { status: 401, headers: NO_STORE });
  if (!pilotPasswordHash(account.passwordHash)) {
    return NextResponse.json({ error: "هذا الحساب لا يستخدم كلمة مرور صلة حاليًا." }, { status: 409, headers: NO_STORE });
  }

  const limit = rateLimiter.checkRateLimit(
    `auth:change-password:${account.id}:${clientIpFromRequest(request)}`,
    8,
    900,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "محاولات كثيرة — حاول بعد قليل." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(limit.resetSeconds) } },
    );
  }

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    if (!request.headers.get("content-type")?.includes("application/json") || Number(request.headers.get("content-length") ?? 0) > 4096) throw new Error();
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات الطلب غير صالحة." }, { status: 400, headers: NO_STORE });
  }

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const policyError = passwordPolicyError(newPassword);
  if (policyError) return NextResponse.json({ error: policyError }, { status: 422, headers: NO_STORE });

  try {
    if (!(await verifyPilotPassword(currentPassword, account.passwordHash))) {
      return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة." }, { status: 401, headers: NO_STORE });
    }

    const passwordHash = await hashPilotPassword(newPassword);
    await db.transaction(async (tx) => {
      await tx.update(accounts).set({ passwordHash }).where(eq(accounts.id, account.id));
      await tx.delete(sessions).where(eq(sessions.accountId, account.id));
    });

    const token = await createSession(account.id);
    const response = NextResponse.json(
      { ok: true, message: "تم تغيير كلمة المرور وتسجيل الخروج من الجلسات الأخرى." },
      { headers: NO_STORE },
    );
    const cookie = sessionCookie(token);
    response.cookies.set(cookie.name, cookie.value, cookie);
    return response;
  } catch (error) {
    if (error instanceof PasswordCapacityError) {
      return NextResponse.json({ error: "الخدمة مشغولة الآن — حاول بعد قليل." }, { status: 429, headers: NO_STORE });
    }
    return NextResponse.json({ error: "تعذر تغيير كلمة المرور الآن." }, { status: 503, headers: NO_STORE });
  }
}
