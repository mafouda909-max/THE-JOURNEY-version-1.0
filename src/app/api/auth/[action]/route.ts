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

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_PHOTO =
  "https://images.pexels.com/photos/16900964/pexels-photo-16900964.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800";

// Naive login throttle: 8 attempts / minute / ip+email (single-instance seam)
const attempts = new Map<string, { n: number; reset: number }>();
function throttled(key: string): boolean {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || rec.reset < now) {
    attempts.set(key, { n: 1, reset: now + 60_000 });
    return false;
  }
  rec.n += 1;
  return rec.n > 8;
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { email, password, name, role, city } = (body ?? {}) as Record<string, unknown>;

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: "صيغة البريد غير صحيحة." }, { status: 422 });
  }
  const mail = email.trim().toLowerCase();
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "كلمة المرور ٨ أحرف على الأقل." }, { status: 422 });
  }

  if (throttled(`${action}:${mail}`)) {
    return NextResponse.json(
      { error: "محاولات كثيرة — انتظر دقيقة ثم أعد المحاولة." },
      { status: 429 },
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

  if (action === "signup") {
    if (typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "الاسم مطلوب." }, { status: 422 });
    }
    const signupRole = role === "agent" ? "agent" : "traveler";

    const existing = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.email, mail)).limit(1);
    if (existing[0]) {
      return NextResponse.json(
        { error: "هذا البريد مسجل — جرّب تسجيل الدخول." },
        { status: 409 },
      );
    }

    let agentId: number | null = null;
    if (signupRole === "agent") {
      // Self-serve onboarding: agent starts as 'pending' — verified only after
      // a real admin review decision. Never claim verification preemptively.
      const [agent] = await db
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

    const [account] = await db
      .insert(accounts)
      .values({
        email: mail,
        passwordHash: hashPassword(password),
        role: signupRole,
        displayName: name.trim(),
        agentId,
      })
      .returning();

    const token = await createSession(account.id);
    const res = NextResponse.json(
      { ok: true, role: account.role, accountId: account.id },
      { status: 201 },
    );
    const c = sessionCookie(token);
    res.cookies.set(c.name, c.value, c);
    return res;
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 404 });
}
