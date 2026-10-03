import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { BRAND } from "@/lib/brand";
import { resolveAuthOrigin } from "@/lib/auth-origin";
import { emailProvider } from "@/lib/providers/email";
import {
  createMagicChallenge,
  invalidateMagicChallenge,
  normalizeAuthEmail,
  normalizeAuthIntent,
  normalizeSelfServeRole,
} from "@/lib/passwordless-auth";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = resolveAuthOrigin(request.url);
  if (process.env.NEXT_PUBLIC_MAGIC_LINK_ENABLED !== "true" || !origin) {
    return NextResponse.json({ error: "تسجيل الدخول عبر البريد غير مفعّل بعد." }, { status: 503 });
  }

  const ip = clientIpFromRequest(request);
  const ipLimit = rateLimiter.checkRateLimit(`auth:magic:ip:${ip}`, 8, 900);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "محاولات كثيرة — حاول مرة أخرى بعد قليل." },
      { status: 429, headers: { "Retry-After": String(ipLimit.resetSeconds) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = normalizeAuthEmail(body.email);
  if (!email) return NextResponse.json({ error: "صيغة البريد غير صحيحة." }, { status: 422 });

  const mailLimit = rateLimiter.checkRateLimit(`auth:magic:mail:${email}`, 3, 900);
  if (!mailLimit.allowed) {
    return NextResponse.json(
      { error: "تم إرسال رابط حديث لهذا البريد. انتظر قليلًا قبل طلب رابط جديد." },
      { status: 429, headers: { "Retry-After": String(mailLimit.resetSeconds) } },
    );
  }

  const intent = normalizeAuthIntent(body.intent);
  const requestedRole = normalizeSelfServeRole(body.role) ?? "traveler";
  const existing = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);

  // Never reveal whether an admin or unknown login email exists.
  if (
    existing[0]?.role === "admin" ||
    (intent === "login" && !existing[0])
  ) {
    return NextResponse.json(
      { ok: true, message: "إذا كان البريد مؤهلًا للدخول فسيصلك رابط صالح لفترة قصيرة." },
      { status: 202 },
    );
  }

  const challenge = await createMagicChallenge({
    email,
    requestedRole,
    intent,
    displayName: typeof body.name === "string" ? body.name : null,
    city: typeof body.city === "string" ? body.city : null,
  });

  const link = new URL("/api/auth/magic/consume", origin);
  link.searchParams.set("token", challenge.token);

  const sent = await emailProvider.sendEmail({
    to: email,
    subject: `رابط الدخول إلى ${BRAND.nameAr}`,
    text: `افتح هذا الرابط لإكمال تسجيل الدخول إلى ${BRAND.nameAr}. الرابط صالح لمدة 15 دقيقة ويُستخدم مرة واحدة:\n${link.toString()}`,
    html: `<p>افتح الرابط التالي لإكمال تسجيل الدخول إلى <strong>${BRAND.nameAr}</strong>.</p><p><a href="${link.toString()}">المتابعة إلى صلة</a></p><p>الرابط صالح لمدة 15 دقيقة ويُستخدم مرة واحدة.</p>`,
    idempotencyKey: `magic-link-${challenge.expiresAt.getTime()}`,
  });

  if (!sent.sent) {
    await invalidateMagicChallenge(challenge.token);
    return NextResponse.json(
      { error: "خدمة البريد غير جاهزة لإرسال رابط الدخول الآن." },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { ok: true, message: "أرسلنا رابط دخول آمنًا إلى بريدك. الرابط صالح لمدة 15 دقيقة ويُستخدم مرة واحدة." },
    { status: 202 },
  );
}
