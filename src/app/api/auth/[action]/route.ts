import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, agents } from "@/db/schema";
import {
  accountFromRequest,
  createSession,
  endSession,
  hashPassword,
  sessionCookie,
  verifyPassword,
} from "@/lib/identity";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_PHOTO =
  "https://images.pexels.com/photos/16900964/pexels-photo-16900964.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800";

function pgCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 6; depth += 1) {
    if (typeof current !== "object" || current === null) return null;
    if ("code" in current) {
      const code = String((current as { code?: unknown }).code ?? "");
      if (code) return code;
    }
    if (!("cause" in current)) return null;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

type Params = { action: string };

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  const { action } = await params;
  if (action !== "me") {
    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  }
  const account = await accountFromRequest(request);
  if (!account) return NextResponse.json({ account: null }, { status: 401 });

  let agent = null;
  if (account.agentId) {
    const rows = await db.select().from(agents).where(eq(agents.id, account.agentId)).limit(1);
    agent = rows[0] ?? null;
  }
  return NextResponse.json({
    account: {
      id: account.id,
      email: account.email,
      role: account.role,
      displayName: account.displayName,
    },
    agent,
  });
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
    const res = NextResponse.json({ ok: true });
    res.cookies.set(sessionCookie("").name, "", { maxAge: 0, path: "/" });
    return res;
  }

  if (action !== "login" && action !== "signup") {
    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  }

  const ip = clientIpFromRequest(request);
  const ipLimit = action === "signup"
    ? rateLimiter.checkRateLimit(`auth:signup:ip:${ip}`, 5, 600)
    : rateLimiter.checkRateLimit(`auth:login:ip:${ip}`, 20, 300);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "محاولات كثيرة — حاول مرة أخرى بعد قليل." },
      { status: 429, headers: { "Retry-After": String(ipLimit.resetSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { email, password, name, role, city } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof email !== "string" ||
    email.trim().length > 200 ||
    !EMAIL_RE.test(email.trim())
  ) {
    return NextResponse.json({ error: "صيغة البريد غير صحيحة." }, { status: 422 });
  }
  const mail = email.trim().toLowerCase();
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: "كلمة المرور بين ٨ و١٢٨ حرفًا." }, { status: 422 });
  }

  const identityLimit = action === "signup"
    ? rateLimiter.checkRateLimit(`auth:signup:mail:${mail}`, 3, 600)
    : rateLimiter.checkRateLimit(`auth:login:mail:${mail}`, 8, 60);
  if (!identityLimit.allowed) {
    return NextResponse.json(
      { error: "محاولات كثيرة — حاول مرة أخرى بعد قليل." },
      { status: 429, headers: { "Retry-After": String(identityLimit.resetSeconds) } },
    );
  }

  if (action === "login") {
    const rows = await db.select().from(accounts).where(eq(accounts.email, mail)).limit(1);
    const account = rows[0];
    if (!account || !verifyPassword(password, account.passwordHash)) {
      return NextResponse.json({ error: "بيانات الدخول غير صحيحة." }, { status: 401 });
    }
    const token = await createSession(account.id);
    const res = NextResponse.json({ ok: true, role: account.role });
    const c = sessionCookie(token);
    res.cookies.set(c.name, c.value, c);
    return res;
  }

  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120) {
    return NextResponse.json({ error: "الاسم مطلوب وبحد أقصى ١٢٠ حرفًا." }, { status: 422 });
  }
  if (typeof city === "string" && city.trim().length > 120) {
    return NextResponse.json({ error: "اسم المدينة طويل جدًا." }, { status: 422 });
  }
  const signupRole = role === "agent" ? "agent" : "traveler";

  const existing = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.email, mail)).limit(1);
  if (existing[0]) {
    return NextResponse.json(
      { error: "هذا البريد مسجل — جرّب تسجيل الدخول." },
      { status: 409 },
    );
  }

  const passwordHash = hashPassword(password);
  let account: typeof accounts.$inferSelect;
  try {
    account = await db.transaction(async (tx) => {
      let agentId: number | null = null;
      if (signupRole === "agent") {
        const [agent] = await tx
          .insert(agents)
          .values({
            displayName: name.trim(),
            latinName: name.trim(),
            bio: "",
            photoUrl: DEFAULT_PHOTO,
            city: typeof city === "string" && city.trim() ? city.trim() : "—",
            country: "السعودية",
            licenseType: "individual",
            licenseNumber: null,
            verificationStatus: "pending",
            verifiedAt: null,
            specialtyTags: [],
            languages: ["العربية"],
            responseRate: 0,
            avgResponseHours: 0,
            totalTrips: 0,
          })
          .returning({ id: agents.id });
        agentId = agent.id;
      }

      const [insertedAccount] = await tx
        .insert(accounts)
        .values({
          email: mail,
          passwordHash,
          role: signupRole,
          displayName: name.trim(),
          agentId,
        })
        .returning();
      return insertedAccount;
    });
  } catch (error) {
    if (pgCode(error) === "23505") {
      return NextResponse.json(
        { error: "هذا البريد مسجل — جرّب تسجيل الدخول." },
        { status: 409 },
      );
    }
    console.error("auth.signup.failed", { code: pgCode(error) ?? "unknown" });
    return NextResponse.json(
      { error: "تعذر إنشاء الحساب الآن. حاول مرة أخرى." },
      { status: 500 },
    );
  }

  const token = await createSession(account.id);
  const res = NextResponse.json(
    { ok: true, role: account.role, accountId: account.id },
    { status: 201 },
  );
  const c = sessionCookie(token);
  res.cookies.set(c.name, c.value, c);
  return res;
}
