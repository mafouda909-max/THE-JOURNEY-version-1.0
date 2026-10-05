import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, agents } from "@/db/schema";
import {
  accountFromRequest,
  createSession,
  endSession,
  sessionCookie,
  verifyPassword,
} from "@/lib/identity";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";
import { normalizeAuthEmail } from "@/lib/passwordless-auth";
import { passwordAuthPost } from "@/lib/password-auth";
import { pilotPasswordHash } from "@/lib/password-credentials";
import { accountEmailVerified } from "@/lib/password-recovery";

export const dynamic = "force-dynamic";

type Params = { action: string };

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  const { action } = await params;
  if (action !== "me" && action !== "session") {
    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  }

  const account = await accountFromRequest(request);
  if (action === "session") {
    // Public chrome only needs session state. Anonymous is a normal result;
    // lookup failures still propagate and never masquerade as signed-out.
    return NextResponse.json({ role: account?.role ?? null }, { headers: { "Cache-Control": "private, no-store" } });
  }
  if (!account) return NextResponse.json({ account: null }, { status: 401, headers: { "Cache-Control": "private, no-store" } });

  let agent = null;
  if (account.agentId) {
    const rows = await db.select().from(agents).where(eq(agents.id, account.agentId)).limit(1);
    agent = rows[0] ?? null;
  }

  const emailVerified = pilotPasswordHash(account.passwordHash)
    ? await accountEmailVerified(account.id, account.email)
    : true;

  return NextResponse.json({
    account: {
      id: account.id,
      email: account.email,
      role: account.role,
      displayName: account.displayName,
      emailVerified,
    },
    agent,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  const { action } = await params;

  if (action === "logout") {
    const cookie = request.headers.get("cookie") ?? "";
    const match = cookie.match(/(?:^|;\s*)tj_sess=([^;]+)/);
    if (match?.[1]) await endSession(match[1]);
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
    response.cookies.set(sessionCookie("").name, "", { maxAge: 0, path: "/" });
    return response;
  }

  if (action === "signup") {
    return passwordAuthPost(request, "signup");
  }

  if (action !== "login") {
    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  }

  if (process.env.PASSWORD_AUTH_ENABLED === "true") return passwordAuthPost(request, "login");

  if (process.env.LEGACY_PASSWORD_LOGIN_ENABLED !== "true") {
    return NextResponse.json(
      { error: "الدخول بكلمة المرور القديمة غير مفعّل. استخدم Google أو رابط البريد." },
      { status: 410 },
    );
  }

  const ip = clientIpFromRequest(request);
  const ipLimit = rateLimiter.checkRateLimit(`auth:legacy-login:ip:${ip}`, 12, 300);
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
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة." }, { status: 401 });
  }

  const identityLimit = rateLimiter.checkRateLimit(`auth:legacy-login:mail:${email}`, 8, 60);
  if (!identityLimit.allowed) {
    return NextResponse.json(
      { error: "محاولات كثيرة — حاول مرة أخرى بعد قليل." },
      { status: 429, headers: { "Retry-After": String(identityLimit.resetSeconds) } },
    );
  }

  const rows = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
  const account = rows[0];
  if (
    !account ||
    (account.role === "admin" && process.env.LEGACY_ADMIN_PASSWORD_LOGIN_ENABLED !== "true") ||
    !verifyPassword(password, account.passwordHash)
  ) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة." }, { status: 401 });
  }

  const token = await createSession(account.id);
  const response = NextResponse.json({ ok: true, role: account.role });
  const cookie = sessionCookie(token);
  response.cookies.set(cookie.name, cookie.value, cookie);
  return response;
}
