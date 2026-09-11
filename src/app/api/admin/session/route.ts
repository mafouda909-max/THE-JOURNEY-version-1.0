import { NextResponse } from "next/server";
import {
  adminAuthConfigured,
  adminKeyMatches,
  createAdminSessionToken,
  isAdminRequest,
} from "@/lib/auth";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  return NextResponse.json(
    {
      configured: adminAuthConfigured,
      authed: adminAuthConfigured && isAdminRequest(request),
    },
    { headers: NO_STORE },
  );
}

export async function POST(request: Request) {
  if (!adminAuthConfigured) {
    return NextResponse.json(
      { configured: false, error: "Admin access is not configured on the server." },
      { status: 503, headers: NO_STORE },
    );
  }

  const limit = rateLimiter.checkRateLimit(
    `admin-login:${clientIpFromRequest(request)}`,
    5,
    900,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "محاولات كثيرة — أعد المحاولة لاحقًا." },
      {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(limit.resetSeconds) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: NO_STORE },
    );
  }

  const { key } = (body ?? {}) as Record<string, unknown>;
  if (typeof key !== "string" || key.length > 512 || !adminKeyMatches(key)) {
    return NextResponse.json(
      { error: "مفتاح غير صحيح." },
      { status: 401, headers: NO_STORE },
    );
  }

  const token = createAdminSessionToken();
  if (!token) {
    return NextResponse.json(
      { error: "تعذر إنشاء الجلسة الإدارية." },
      { status: 503, headers: NO_STORE },
    );
  }

  const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
  res.cookies.set("tj_admin", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
  res.cookies.set("tj_admin", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
