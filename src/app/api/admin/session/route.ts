import { NextResponse } from "next/server";
import { adminAuthConfigured, adminKeyMatches, isAdminRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return NextResponse.json({
    configured: adminAuthConfigured,
    authed: adminAuthConfigured && isAdminRequest(request),
  });
}

export async function POST(request: Request) {
  if (!adminAuthConfigured) {
    return NextResponse.json(
      { configured: false, error: "ADMIN_API_KEY is not set on the server." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { key } = (body ?? {}) as Record<string, unknown>;
  if (!adminKeyMatches(key)) {
    return NextResponse.json({ error: "مفتاح غير صحيح." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("tj_admin", key as string, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("tj_admin", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
